#include "core/ApiManager.h"
#include "Config.h"
#include "core/BoardManager.h"
#include "core/DimmerManager.h"
#include "core/LedManager.h"
#include "core/MqttManager.h"
#include "core/RelayManager.h"
#include "preferences/PreferencesManager.h"
#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>


namespace ApiManager {

// ==================================================
// HTTPS support — server URL agar https:// hai toh secure
// connection (WiFiClientSecure). Certificate bundle nahi hai
// isliye setInsecure() — data TLS me encrypted jaata hai (MITM
// risk kabhi-kabhi, par plain HTTP se kaafi behtar). Plain HTTP
// URLs pe purana behaviour hi rehta hai.
// ==================================================
static WiFiClient plainClient;
static WiFiClientSecure secureClient;
static bool clientForUrl(const String &url, HTTPClient &http,
                         bool secureOnly = false) {
  bool useSecure =
      url.startsWith("https://") || (secureOnly && url.startsWith("https://"));
  if (useSecure) {
    secureClient.setInsecure();
    return http.begin(secureClient, url);
  }
  return http.begin(url);
}

// Command poller apne dedicated task (core 0) se chalta hai — uske liye ALAG
// TLS client rakhte hain taaki main loop
// (downloadDevices/heartbeat/updateDevice) wale secureClient se ek hi
// connection pe conflict na ho. Aisi sharing se dono ek saath TLS session
// corrupt kar sakte the.
static WiFiClientSecure commandSecureClient;
static bool commandClientForUrl(const String &url, HTTPClient &http) {
  if (url.startsWith("https://")) {
    commandSecureClient.setInsecure();
    return http.begin(commandSecureClient, url);
  }
  return http.begin(url);
}

// ==================================================
// Debounced Batch Push Queue
//
// Problem: har relay toggle (web ya physical switch) turant ek
// synchronous HTTP POST karta tha — ek-ek karke, har ek 500ms
// timeout ke saath. Isliye short interval ke updates late/laggy
// feel hote the aur same device ke duplicate toggles bekaar push
// karte the.
//
// Fix: queueDeviceUpdate() pending table mein dalta hai aur 300ms
// baad update() ek saath (burst) flush karta hai. Same device ka
// duplicate toggle coalesce hota hai — sirf latest state jaati hai.
// ==================================================

static const int MAX_PENDING = 8;

static int pendingDeviceId[MAX_PENDING];
static bool pendingState[MAX_PENDING];
static bool pendingValid[MAX_PENDING];
static int pendingCount = 0;
static unsigned long flushAt = 0;

static const unsigned long DEBOUNCE_MS = 300;
static const unsigned long RETRY_MS = 3000;

static int findPending(int deviceId) {
  for (int i = 0; i < MAX_PENDING; i++) {
    if (pendingValid[i] && pendingDeviceId[i] == deviceId)
      return i;
  }
  return -1;
}

// Pending table ko burst mein flush karo. Fail hone wale entries
// pending hi rehti hain (baad mein retry ke liye).
static bool flushPending() {
  bool allOk = true;

  for (int i = 0; i < MAX_PENDING; i++) {
    if (!pendingValid[i])
      continue;

    bool ok = updateDevice(pendingDeviceId[i], pendingState[i]);

    if (ok) {
      pendingValid[i] = false;
      pendingCount--;
    } else {
      allOk = false;
    }
  }

  return allOk;
}

bool queueDeviceUpdate(int deviceId, bool state) {
  int idx = findPending(deviceId);

  if (idx != -1) {
    // Coalesce — same device, latest state wins
    pendingState[idx] = state;
  } else {
    if (pendingCount >= MAX_PENDING) {
      // Table full — turant flush karke jagah banao
      flushPending();
      idx = findPending(deviceId);
    }

    if (idx == -1) {
      idx = -1;
      for (int i = 0; i < MAX_PENDING; i++) {
        if (!pendingValid[i]) {
          idx = i;
          break;
        }
      }
    }

    if (idx == -1)
      return false;

    pendingDeviceId[idx] = deviceId;
    pendingState[idx] = state;
    pendingValid[idx] = true;
    pendingCount++;
  }

  // MQTT Fast-path: if MQTT is connected, publish the state immediately
  // without waiting for the HTTP debounce loop.
  if (MqttManager::isConnected()) {
    MqttManager::publishState();
    // Keep it in pending queue so the next HTTP flush can clear it or ignore
    // it, but actually we could just clear it here to save memory/cycles.
    pendingValid[idx] = false;
    pendingCount--;
    return true;
  }

  // Debounce window — sirf tab set karo jab koi flush scheduled nahi hai.
  // Agar pehle se flush (ya failed retry backoff) chal raha hai toh usko
  // reset mat karo — warna server down hone par har toggle 300ms window
  // dobara set karega aur loop continuously block hota rahega.
  if (flushAt == 0)
    flushAt = millis() + DEBOUNCE_MS;

  return true;
}

void update() {
  if (pendingCount == 0) {
    flushAt = 0;
    return;
  }

  if ((long)(millis() - flushAt) >= 0) {
    if (flushPending()) {
      flushAt = 0;
    } else {
      // Server unreachable ho sakta hai — backoff: 3s baad retry,
      // beech mein new toggles pending mein add hote rahenge par
      // loop ko har 300ms pe block nahi karenge.
      flushAt = millis() + RETRY_MS;
    }
  }
}

// ==================================================
// Server-down exponential backoff
//
// Unreachable server (galat subnet / server off) ko baar-baar
// synchronous HTTP se hit karna main loop ko ARP/connect timeout
// (~seconds) tak block karta hai — isliye sab kuch laggy feel hota
// hai. Fail hone ke baad backoff window tak saare HTTP calls bina
// network attempt ke turant return karte hain. Har failure par
// backoff double hota hai (10s -> 20s -> 40s ... -> 5min cap) —
// persistently dead server ko kabhi-kabhi hi hit karega. Success pe
// wapas base par reset.
// ==================================================
static unsigned long backoffUntil = 0;
static unsigned long currentBackoff = 10000;
static const unsigned long BACKOFF_MIN = 10000;
static const unsigned long BACKOFF_MAX = 300000; // 5 min

static bool inBackoff() { return (millis() < backoffUntil); }

static void markFailure() {
  currentBackoff *= 2;
  if (currentBackoff > BACKOFF_MAX)
    currentBackoff = BACKOFF_MAX;
  backoffUntil = millis() + currentBackoff;
}

static void markSuccess() {
  currentBackoff = BACKOFF_MIN;
  backoffUntil = 0;
}

bool testConnection() {
  // Manual test — backoff bypass karo (user ne khud test kiya hai)
  HTTPClient http;

  String url =
      PreferencesManager::getServerURL() +
      "/api/device/read-all?api_key=" + PreferencesManager::getApiKey();

  clientForUrl(url, http);
  http.setTimeout(5000);
  http.setConnectTimeout(3000);
  int httpCode = http.GET();

  http.end();

  if (httpCode == 200) {
    markSuccess();
    return true;
  }

  markFailure();
  return false;
}

bool downloadDevices() {
  if (inBackoff())
    return false;

  if (WiFi.status() != WL_CONNECTED)
    return false;

  String serverURL = PreferencesManager::getServerURL();
  String apiKey = PreferencesManager::getApiKey();

  if (serverURL.isEmpty())
    return false;

  if (apiKey.isEmpty())
    return false;
  HTTPClient http;

  String url =
      PreferencesManager::getServerURL() +
      "/api/device/read-all?api_key=" + PreferencesManager::getApiKey() +
      "&mac=" + WiFi.macAddress();

  clientForUrl(url, http);
  http.setTimeout(5000);
  http.setConnectTimeout(3000);
  int httpCode = http.GET();

  if (httpCode != 200) {
    LedManager::setMode(LedManager::SERVER_ERROR);
    Serial.print("HTTP Code : ");
    Serial.println(httpCode);
    http.end();
    markFailure();
    return false;
  }

  String payload = http.getString();
  http.end();

  DynamicJsonDocument doc(2048);
  DeserializationError error = deserializeJson(doc, payload);

  if (error) {
    Serial.print("JSON Error : ");
    Serial.println(error.c_str());
    return false;
  }

  // Direct mapping to Channels
  if (doc["data"].containsKey("led")) {
    if (doc["data"]["led"] == 1)
      LedManager::enable();
    else
      LedManager::disable();
  }

  JsonArray states = doc["data"]["states"].as<JsonArray>();
  int ch = 0;
  for (int state : states) {
    if (state == 1)
      RelayManager::on(ch);
    else
      RelayManager::off(ch);
    ch++;
  }

  markSuccess();
  return true;
}
bool updateDevice(int deviceId, bool state) {
  if (inBackoff())
    return false;

  // If MQTT is connected, we don't need to do HTTP POSTs
  if (MqttManager::isConnected()) {
    return true; // Pretend it succeeded so flush clears it
  }

  // WiFi down hai toh HTTP attempt hi mat karo — otherwise ARP/connect
  // stall seconds tak loop block karta hai. Pending queue mein update
  // rehta hai, WiFi wapas aate hi flush ho jayega.
  if (WiFi.status() != WL_CONNECTED)
    return false;

  HTTPClient http;

  String url = PreferencesManager::getServerURL() + "/api/device/update";

  clientForUrl(url, http);
  http.setTimeout(500);
  http.setConnectTimeout(1500);

  http.addHeader("Content-Type", "application/x-www-form-urlencoded");

  String postData;

  postData = "api_key=" + PreferencesManager::getApiKey();

  postData += "&channel=" + String(deviceId);
  postData += "&mac=" + WiFi.macAddress();

  postData += "&status=";

  postData += state ? "on" : "off";

  int httpCode = http.POST(postData);

  http.end();

  if (httpCode == 200) {
    markSuccess();
    return true;
  }

  markFailure();
  return false;
}

// ==================================================
// Command Queue (v2)
//
// Web/API se kiya gaya toggle server pe ek 'pending' command banata hai
// (device_commands table). Ye function us queue ko poll karta hai, har
// command ko relay pe apply karta hai aur ack bhejta hai taaki command
// wapas baar-baar na aaye. Device is unit pe map nahi hai toh bhi ack
// kar dete hain — server device state already set hai, ack sirf queue
// cleanup ke liye hai.
// ==================================================
bool downloadCommands() {
  if (inBackoff())
    return false;

  if (WiFi.status() != WL_CONNECTED)
    return false;

  // If MQTT is connected, it receives commands asynchronously. Disable HTTP
  // long-poll.
  if (MqttManager::isConnected())
    return false;

  String serverURL = PreferencesManager::getServerURL();
  String apiKey = PreferencesManager::getApiKey();

  if (serverURL.isEmpty() || apiKey.isEmpty())
    return false;

  HTTPClient http;

  // Long-poll mode (v2): server response ko hold karta hai jab tak command
  // na aaye (max 20s). Command aate hi turant response milta hai → web toggle
  // se relay pe click ~1s ke andar. Yah function ab dedicated command-poll
  // task (core 0) se chalta hai, isliye blocking se loop/web-panel freeze
  // nahi hota. Read timeout = hold + 6s buffer; connect timeout short rehta
  // hai taaki WiFi down pe jaldi fail ho.
  String url = serverURL + "/api/device/commands?api_key=" + apiKey +
               "&mac=" + WiFi.macAddress() + "&long=1&hold=20";

  commandClientForUrl(url, http);
  http.setTimeout(26000);
  http.setConnectTimeout(1500);
  int httpCode = http.GET();

  if (httpCode != 200) {
    http.end();
    return false;
  }

  String payload = http.getString();
  http.end();

  DynamicJsonDocument doc(4096);

  DeserializationError error = deserializeJson(doc, payload);

  if (error) {
    Serial.print("Commands JSON Error : ");
    Serial.println(error.c_str());
    return false;
  }

  if (!doc["success"])
    return false;

  JsonArray commands = doc["data"]["commands"].as<JsonArray>();

  int applied = 0;

  for (JsonObject cmd : commands) {
    int commandId = cmd["id"];
    int channel = cmd["channel"] | -1;
    const char *command = cmd["command"] | "";

    Serial.print("Command #");
    Serial.print(commandId);
    Serial.print(" channel=");
    Serial.print(channel);
    Serial.print(" cmd=");
    Serial.println(command);

    bool state = false;
    bool known = false;

    if (strcmp(command, "set_status:on") == 0) {
      state = true;
      known = true;
    } else if (strcmp(command, "set_status:off") == 0) {
      state = false;
      known = true;
    }

    if (known) {
      if (channel > 0) {
        int relay = channel - 1; // back to 0-indexed
        RelayManager::setState(relay, state);
        Serial.print("  -> Relay ");
        Serial.print(relay);
        Serial.println(state ? " ON" : " OFF");
        applied++;
      }
    }

    // Ack
    ackCommand(commandId, true);
  }

  if (applied > 0)
    markSuccess();

  return true;
}

bool ackCommand(int commandId, bool ok) {
  if (inBackoff())
    return false;

  if (WiFi.status() != WL_CONNECTED)
    return false;

  HTTPClient http;

  String url = PreferencesManager::getServerURL() + "/api/device/commands/ack";

  commandClientForUrl(url, http);
  http.setTimeout(500);
  http.setConnectTimeout(1500);

  http.addHeader("Content-Type", "application/x-www-form-urlencoded");

  String postData;
  postData = "api_key=" + PreferencesManager::getApiKey();
  postData += "&command_id=" + String(commandId);
  postData += "&status=" + String(ok ? "executed" : "failed");

  int httpCode = http.POST(postData);

  http.end();

  // 200 = acked, 409 = already acked (idempotent — no problem)
  if (httpCode == 200 || httpCode == 409) {
    markSuccess();
    return true;
  }

  markFailure();
  return false;
}

bool heartbeat(String &otaUrl) {
  otaUrl = "";

  if (WiFi.status() != WL_CONNECTED)
    return false;

  String serverURL = PreferencesManager::getServerURL();
  String apiKey = PreferencesManager::getApiKey();

  if (serverURL.isEmpty() || apiKey.isEmpty())
    return false;

  String states = "[";
  for (int ch = 0; ch < BoardManager::getRelayCount(); ch++) {
    if (ch > 0)
      states += ",";
    states += RelayManager::getState(ch) ? "1" : "0";
  }
  states += "]";

  HTTPClient http;
  http.setTimeout(API_TIMEOUT_MS);
  clientForUrl(serverURL + "/api/device/heartbeat", http);
  http.addHeader("Content-Type", "application/x-www-form-urlencoded");

  String body = "api_key=" + apiKey;
  body += "&ip=" + WiFi.localIP().toString();
  body += "&fw_version=" + String(FIRMWARE_VERSION);
  body += "&mac=" + WiFi.macAddress();
  body += "&ssid=" + WiFi.SSID();
  body += "&serial=" + PreferencesManager::getSerialCode();
  body += "&model=" + BoardManager::getModelCode();
  body += "&states=" + states;

  int httpCode = http.POST(body);
  if (httpCode != HTTP_CODE_OK) {
    http.end();
    return false;
  }

  String payload = http.getString();
  http.end();

  DynamicJsonDocument doc(2048);
  DeserializationError error = deserializeJson(doc, payload);
  if (error)
    return false;

  if (doc["success"] != true)
    return false;

  // Admin ne is device ko update push kiya hai?
  bool required = doc["data"]["ota"]["required"] | false;
  if (required) {
    otaUrl = doc["data"]["ota"]["url"].as<String>();
  }

  return true;
}

} // namespace ApiManager