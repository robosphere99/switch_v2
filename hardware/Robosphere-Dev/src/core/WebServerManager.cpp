#include "core/WebServerManager.h"
#include "Config.h"
#include "core/ApiManager.h"
#include "core/BoardManager.h"
#include "core/DimmerManager.h"
#include "core/LedManager.h"
#include "core/Logger.h"
#include "core/OTAManager.h"
#include "core/RelayManager.h"
#include "core/StatusManager.h"
#include "core/TimeManager.h"
#include "core/WiFiManager.h"
#include "core/WiFiScanner.h"
#include "preferences/PreferencesManager.h"
#include "web/DashboardPage.h"
#include "web/ServerPage.h"
#include "web/SystemPage.h"
#include "web/UI.h"
#include "web/UIResources.h"
#include "web/WiFiPage.h"
#include <Arduino.h>
#include <ESP.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <WiFi.h>

WebServer server(80);

// ==================================================
// Session-based authentication (per-client)
// Login pe random token ban ke browser cookie mein save hota hai.
// Har request pe cookie validate hoti hai — global isLoggedIn hata diya.
// ==================================================
#define MAX_SESSIONS 4
#define SESSION_TIMEOUT_MS 3600000UL // 1 hour inactivity

struct Session {
  char token[33];
  unsigned long lastSeen;
  bool active;
};

Session sessions[MAX_SESSIONS] = {};

String generateSessionToken() {
  String token = "";
  bool unique = false;

  while (!unique) {
    token = "";

    for (int i = 0; i < 32; i++) {
      token += String((uint8_t)esp_random() % 16, HEX);
    }

    unique = true;

    for (int i = 0; i < MAX_SESSIONS; i++) {
      if (sessions[i].active && strcmp(sessions[i].token, token.c_str()) == 0) {
        unique = false;
        break;
      }
    }
  }

  return token;
}

void purgeExpiredSessions() {
  unsigned long now = millis();

  for (int i = 0; i < MAX_SESSIONS; i++) {
    if (sessions[i].active &&
        (now - sessions[i].lastSeen > SESSION_TIMEOUT_MS)) {
      sessions[i].active = false;
    }
  }
}

String createSession() {
  purgeExpiredSessions();

  String token = generateSessionToken();
  int slot = -1;

  for (int i = 0; i < MAX_SESSIONS; i++) {
    if (!sessions[i].active) {
      slot = i;
      break;
    }
  }

  if (slot == -1) {
    // Saare slots full — sabse purani session overwrite
    slot = 0;

    for (int i = 1; i < MAX_SESSIONS; i++) {
      if (sessions[i].lastSeen < sessions[slot].lastSeen) {
        slot = i;
      }
    }
  }

  strncpy(sessions[slot].token, token.c_str(), 32);
  sessions[slot].token[32] = '\0';
  sessions[slot].lastSeen = millis();
  sessions[slot].active = true;

  return token;
}

void destroySession(const String &token) {
  for (int i = 0; i < MAX_SESSIONS; i++) {
    if (sessions[i].active && strcmp(sessions[i].token, token.c_str()) == 0) {
      sessions[i].active = false;
      return;
    }
  }
}

String getCookieSessionToken() {
  String cookie = server.header("Cookie");
  int idx = cookie.indexOf("session=");

  if (idx < 0)
    return "";

  String rest = cookie.substring(idx + 8);
  int end = rest.indexOf(';');

  if (end >= 0)
    rest = rest.substring(0, end);

  rest.trim();

  return rest;
}

bool isValidSession(const String &token) {
  if (token.length() != 32)
    return false;

  unsigned long now = millis();

  for (int i = 0; i < MAX_SESSIONS; i++) {
    if (sessions[i].active && strcmp(sessions[i].token, token.c_str()) == 0) {
      if (now - sessions[i].lastSeen > SESSION_TIMEOUT_MS) {
        sessions[i].active = false;
        return false;
      }

      sessions[i].lastSeen = now;
      return true;
    }
  }

  return false;
}

void handleRoot();
void handleSetup();
void handleLogin();
void handleDashboard();
void handleSave();
void handleLogout();
void handleLoginPost();
void handleServer();
void handleServerSave();
void handleServerTest();
void handleLogout();
void handleSystem();
void handleSystemLed();
void handleWiFi();
void handleWiFiSave();
bool checkLogin() {
  String token = getCookieSessionToken();

  if (!token.isEmpty() && isValidSession(token))
    return true;

  server.sendHeader("Location", "/");
  server.send(303);

  return false;
}

void handleRoot() {
  if (!PreferencesManager::isConfigured()) {
    handleSetup();
    return;
  }

  handleLogin();
}

void handleSetup() {
  String html;

  html += uiHead("Setup - SwitchNest IoT");

  html += uiAuthBegin();

  // Provisioning tool se set kiye gaye defaults pre-fill karo —
  // buyer apne hisaab se change kar sakta hai.
  String defAdminUser = PreferencesManager::getAdminUsername();
  String defAdminPass = PreferencesManager::getAdminPassword();

  defAdminUser.replace("&", "&amp;");
  defAdminUser.replace("<", "&lt;");
  defAdminUser.replace(">", "&gt;");
  defAdminUser.replace("\"", "&quot;");
  defAdminPass.replace("&", "&amp;");
  defAdminPass.replace("<", "&lt;");
  defAdminPass.replace(">", "&gt;");
  defAdminPass.replace("\"", "&quot;");

  // Server URL/API — provisioning tool se pre-set ho toh pre-fill dikhe
  String defServerUrl = PreferencesManager::getServerURL();
  String defApiKey = PreferencesManager::getApiKey();
  defServerUrl.replace("&", "&amp;");
  defServerUrl.replace("<", "&lt;");
  defServerUrl.replace(">", "&gt;");
  defServerUrl.replace("\"", "&quot;");
  defApiKey.replace("&", "&amp;");
  defApiKey.replace("<", "&lt;");
  defApiKey.replace(">", "&gt;");
  defApiKey.replace("\"", "&quot;");

  html += R"rawliteral(
<div class="glass auth-card">
<div class="logo">⚡</div>
<h1>SwitchNest IoT</h1>
<p class="sub">Setup your device</p>

<h3 class="sectionTitle">Restore Previous Configuration</h3>

<label class="file-box" for="configFile">
<span>📂</span>
<input type="file" id="configFile" accept=".json">
<span class="file-name" id="configFileName">No file selected</span>
</label>

<button type="button" class="success" onclick="restoreBackup()">Restore Backup</button>

<div class="divider-text">OR</div>

<form action="/save" method="POST">

<label>Admin Username</label>

<input
name="admin_user"
type="text"
placeholder="admin"
value="";
html += defAdminUser;
html += R"rawliteral("
required>

<label>Admin Password</label>

<input
name="admin_pass"
type="password"
placeholder="Password"
value="";
html += defAdminPass;
html += R"rawliteral("
required>

<label>WiFi Network</label>

<div class="field-row">

<select
id="wifi_ssid"
name="wifi_ssid"
required>
<option value="">Scanning...</option>
</select>

<button type="button" class="btn-sm ghost" onclick="scanWifi()">⟳ Refresh</button>

</div>

<label>WiFi Password</label>

<input
name="wifi_pass"
type="password"
placeholder="WiFi password"
required>

<label>Server URL (optional — devices sync ke liye)</label>

<input
name="server_url"
type="text"
placeholder="https://yourserver.com/api/"
value="";
html += defServerUrl;
html += R"rawliteral("
>

<label>API Key (optional)</label>

<input
name="api_key"
type="text"
placeholder="API key"
value="";
html += defApiKey;
html += R"rawliteral("
>

<button type="submit">Save Configuration</button>

</form>

<p class="hint">💡 Save ke baad device WiFi se connect hoga — aur AP (192.168.4.1) bhi ON rahega, isliye IP dhoondhne ki zaroorat nahi.</p>

</div>
<script>

document.getElementById("configFile").addEventListener("change", function(){
    var f = this.files[0];
    document.getElementById("configFileName").textContent = f ? f.name : "No file selected";
});

async function restoreBackup()
{
    const file=document.getElementById("configFile").files[0];

    if(!file)
    {
        alert("Please select a backup file.");
        return;
    }

    let text;

    try
    {
        text=await file.text();
    }
    catch(e)
    {
        alert("Unable to read file.");
        return;
    }

    let config;

    try
    {
        config=JSON.parse(text);
    }
    catch(e)
    {
        alert("Invalid JSON File.");
        return;
    }

    if(
        config.configVersion===undefined ||
        config.wifi===undefined ||
        config.server===undefined ||
        config.admin===undefined ||
        config.mapping===undefined
    )
    {
        alert("This is not a SwitchNest configuration file.");
        return;
    }

    let summary =
    "Restore Configuration?\n\n"+
    "WiFi : " + config.wifi.ssid +
    "\nAdmin : " + config.admin.username +
    "\n\nExisting configuration will be overwritten.";

    if(!confirm(summary))
        return;

    fetch("/config/import",
    {
        method:"POST",
        headers:
        {
            "Content-Type":"application/json"
        },
        body:text
    })
    .then(r=>r.json())
    .then(data=>
    {
        alert(data.message);
    })
    .catch(()=>
    {
        alert("Restore Failed");
    });
}
async function scanWifi()
{
    const select=document.getElementById("wifi_ssid");

    select.innerHTML="<option>Scanning...</option>";

    try
    {
        const response=await fetch("/wifi/scan");

        const list=await response.json();

        select.innerHTML="";

        if(list.length==0)
        {
            select.innerHTML=
            "<option value=''>No Networks Found</option>";
            return;
        }

        list.forEach(function(network)
{
    let option = document.createElement("option");

    option.value = network.ssid;

    option.textContent =
        "📶 " + network.ssid +
        " (" + network.rssi + " dBm)";

    select.appendChild(option);
});
    }
    catch(e)
    {
        select.innerHTML=
        "<option value=''>Scan Failed</option>";
    }
}
    window.onload=function()
{
    scanWifi();
}
</script>
)rawliteral";

  html += uiEnd();

  if (!PreferencesManager::isConfigured()) {
    server.send(200, "text/html", html);
    return;
  }

  // Dashboard (temporary)
  server.send(200, "text/html",
              "<h1>SwitchNest IoT</h1><h2>Device Configured Successfully</h2>");
}
void handleLogin() {
  String html;

  html += uiHead("Login - SwitchNest IoT");

  html += uiAuthBegin();

  // Default credentials pre-fill karo (user ko dikh jaaye kya dalna hai)
  String defUser = PreferencesManager::getAdminUsername();
  defUser.replace("&", "&amp;");
  defUser.replace("<", "&lt;");
  defUser.replace(">", "&gt;");

  html += R"rawliteral(
<div class="glass auth-card">
<div class="logo">⚡</div>
<h1>SwitchNest IoT</h1>
<p class="sub">Smart Switch Controller</p>
<form action="/login" method="POST">
<label>Username</label>
<input type="text" name="username" placeholder="Username" value=")rawliteral";
  html += defUser;
  html += R"rawliteral(" required>
<label>Password</label>
<div class="pw-wrap">
<input type="password" name="password" id="pw" placeholder="Password" required>
<button type="button" class="pw-toggle" id="pwToggle" aria-label="Show password">👁</button>
</div>
<p class="hint" style="margin-top:4px;font-size:11px;opacity:0.6">Default: admin / admin</p>
<button type="submit">Login</button>
</form>
</div>
<script>
document.getElementById('pwToggle').addEventListener('click',function(){
  var i=document.getElementById('pw');
  i.type=(i.type==='password')?'text':'password';
  this.textContent=(i.type==='password')?'👁':'🙈';
});
</script>
)rawliteral";

  html += uiEnd();

  server.send(200, "text/html", html);
}
void handleSave() {
  String adminUser = server.arg("admin_user");
  String adminPass = server.arg("admin_pass");

  String wifiSSID = server.arg("wifi_ssid");
  String wifiPass = server.arg("wifi_pass");

  // Setup page se hi server URL + API key — ek hi baar mein sab configure
  PreferencesManager::saveServer(server.arg("server_url"),
                                 server.arg("api_key"));

  // Naya key setup se aaya — provisioning mode clear
  PreferencesManager::saveKeyInvalid(false);

  PreferencesManager::saveAdmin(adminUser, adminPass);
  PreferencesManager::saveWiFi(wifiSSID, wifiPass);
  PreferencesManager::setConfigured(true);

  String html;
  html += uiHead("Configuration Saved");
  html += uiAuthBegin();
  html +=
      "<div class='glass auth-card msg-card ok'><div class='msg-icon'>✅</div>";
  html += "<h2>Configuration Saved</h2>";
  html += "<p class='msg-sub'>Device restarting... WiFi connect hoga aur AP "
          "(192.168.4.1) bhi ON rahega — kisi bhi jagah se khul jayega.</p>";
  html += "</div>";
  html += uiEnd();

  server.send(200, "text/html", html);

  delay(1500);

  ESP.restart();
}
void handleLoginPost() {
  String username = server.arg("username");
  String password = server.arg("password");

  if (username == PreferencesManager::getAdminUsername() &&
      password == PreferencesManager::getAdminPassword()) {
    String token = createSession();

    server.sendHeader("Set-Cookie", "session=" + token + "; Path=/; HttpOnly");
    server.sendHeader("Location", "/dashboard");
    server.send(303);
  } else {
    delay(800); // Brute-force slow down

    String html;
    html += uiHead("Login Failed");
    html += uiAuthBegin();
    html += "<div class='glass auth-card msg-card err'><div "
            "class='msg-icon'>❌</div>";
    html += "<h2>Invalid Credentials</h2>";
    html += "<p class='msg-sub'>Username ya password galat hai.</p>";
    html += "<button onclick=\"location.href='/'\">← Try Again</button>";
    html += "</div>";
    html += uiEnd();

    server.send(200, "text/html", html);
  }
}
void handleDashboard() {
  if (!checkLogin())
    return;

  String html = DashboardPage(
      WiFiManager::getIP(), PreferencesManager::getWiFiSSID(), FIRMWARE_VERSION,
      0, 0, BoardManager::getRelayCount(), BoardManager::getBoard()->name,
      WiFi.status() == WL_CONNECTED, WiFiManager::isSetupAccessPoint(),
      WiFiManager::isDualMode(), WiFiManager::getAPIP(),
      WiFiManager::getAPSSID(), WiFiManager::getHostname());

  server.send(200, "text/html", html);
}

void handleServer() {
  if (!checkLogin())
    return;
  server.send(200, "text/html",
              ServerPage(PreferencesManager::getServerURL(),
                         PreferencesManager::getApiKey()));
}
void handleServerSave() {
  if (!checkLogin())
    return;
  PreferencesManager::saveServer(server.arg("server_url"),
                                 server.arg("api_key"));

  // Naya key save hua — provisioning mode clear. Sync turant resume hoga.
  if (PreferencesManager::isKeyInvalid()) {
    PreferencesManager::saveKeyInvalid(false);
    LedManager::setMode(LedManager::HEARTBEAT);
    Serial.println("Key updated — provisioning mode cleared, sync resuming");
  }

  server.sendHeader("Location", "/dashboard");
  server.send(303);
}
void handleServerTest() {
  if (!checkLogin())
    return;

  // testConnection() skips backoff (manual trigger) — download devices on
  // success
  if (ApiManager::testConnection()) {
    // Also sync device list
    ApiManager::downloadDevices();

    String json =
        "{\"success\":true,\"message\":\"Connection OK\",\"count\":0}";
    server.send(200, "application/json", json);
  } else {
    server.send(200, "application/json",
                "{\"success\":false,\"message\":\"Connection failed — URL/key "
                "check karo\"}");
  }
}

void handleLogout() {
  String token = getCookieSessionToken();

  if (!token.isEmpty())
    destroySession(token);

  server.sendHeader("Set-Cookie", "session=; Path=/; Max-Age=0");
  server.sendHeader("Location", "/");
  server.send(303);
}

void handleDownloadDevices() {
  if (!checkLogin())
    return;

  if (ApiManager::downloadDevices()) {
    String json =
        "{\"success\":true,\"message\":\"Devices downloaded\",\"count\":0}";
    server.send(200, "application/json", json);
  } else {
    server.send(200, "application/json",
                "{\"success\":false,\"message\":\"Download failed\"}");
  }
}

void handleSystem() {
  if (!checkLogin())
    return;

  server.send(
      200, "text/html",
      SystemPage(BoardManager::getBoard()->name,
                 PreferencesManager::getSerialCode(), FIRMWARE_VERSION,
                 WiFi.localIP().toString(), millis() / 1000, ESP.getFreeHeap(),

                 TimeManager::getDate(), TimeManager::getTime(),
                 TimeManager::getDay(), TimeManager::isSynced(),

                 OTAManager::getCurrentVersion(),
                 OTAManager::getLatestVersion(), OTAManager::getStatus(),
                 OTAManager::getReleaseNotes(), OTAManager::getProgress(),
                 PreferencesManager::getOTAURL(), LedManager::isEnabled()));
}

void handleSystemLed() {
  if (!checkLogin())
    return;

  // JSON body: { "enabled": true/false }
  String body = server.arg("plain");

  bool enabled = true;

  if (body.indexOf("\"enabled\":false") >= 0)
    enabled = false;

  LedManager::setUserEnabled(enabled);

  String json = "{\"success\":true,\"ledEnabled\":";
  json += enabled ? "true" : "false";
  json += "}";
  server.send(200, "application/json", json);
}

void handleWiFi() {
  if (!checkLogin())
    return;

  server.send(200, "text/html",
              WiFiPage(PreferencesManager::getWiFiSSID(),
                       WiFiScanner::getNetworkOptions(),
                       PreferencesManager::getAPName(),
                       PreferencesManager::getAPPassword()));
}

void handleWiFiSave() {
  if (!checkLogin())
    return;

  String ssid = server.arg("wifi_ssid");

  String password = server.arg("wifi_password");

  // Hotspot (AP) edit — user login karke apna AP naam/password change kar sakta
  // hai.
  String apName = server.arg("ap_name");
  String apPassword = server.arg("ap_password");

  PreferencesManager::saveWiFi(ssid, password);
  PreferencesManager::saveAPName(apName);
  PreferencesManager::saveAPPassword(apPassword);

  String html;
  html += uiHead("Settings Saved");
  html += uiAuthBegin();
  html +=
      "<div class='glass auth-card msg-card ok'><div class='msg-icon'>📶</div>";
  html += "<h2>Settings Saved</h2>";
  html += "<p class='msg-sub'>WiFi + Hotspot saved. Device restarting... naye "
          "network se connect hone ka wait karo.</p>";
  html += "</div>";
  html += uiEnd();

  server.send(200, "text/html", html);

  delay(1500);

  ESP.restart();
}

namespace WebServerManager {

void begin() {
  server.on("/", HTTP_GET, handleRoot);

  server.on("/save", HTTP_POST, handleSave);

  server.on("/login", HTTP_POST, handleLoginPost);

  server.on("/dashboard", HTTP_GET, handleDashboard);

  server.on("/server", HTTP_GET, handleServer);

  server.on("/server/download", HTTP_GET, handleDownloadDevices);

  server.on("/server/save", HTTP_POST, handleServerSave);

  server.on("/server/test", HTTP_GET, handleServerTest);
  server.on("/status", HTTP_GET, []() {
    if (!checkLogin())
      return;

    server.send(200, "application/json", StatusManager::getJson());
  });
  server.on("/relay/toggle", HTTP_POST, []() {
    if (!checkLogin())
      return;

    int index = server.arg("index").toInt();

    if (index < 0 || index >= BoardManager::getRelayCount()) {
      server.send(400, "application/json",
                  "{\"success\":false,\"message\":\"Invalid Relay Index\"}");
      return;
    }

    RelayManager::toggle(index);

    bool state = RelayManager::getState(index);

    int channel = index + 1;

    bool pushed = ApiManager::queueDeviceUpdate(channel, state);

    String deviceName = "";

    String json = "{\"success\":true,\"index\":";
    json += String(index);
    json += ",\"state\":";
    json += state ? "true" : "false";
    json += ",\"pushed\":";
    json += pushed ? "true" : "false";
    json += ",\"deviceName\":\"";
    json += deviceName;
    json += "\"}";

    server.send(200, "application/json", json);
  });
  server.on("/logout", HTTP_GET, handleLogout);
  server.on("/system", HTTP_GET, handleSystem);
  server.on("/system/led", HTTP_POST, handleSystemLed);
  server.on("/wifi", HTTP_GET, handleWiFi);
  server.on("/wifi/save", HTTP_POST, handleWiFiSave);
  server.on("/config/export", HTTP_GET, []() {
    if (!checkLogin())
      return;

    String json = PreferencesManager::exportConfiguration();

    String fileName = server.arg("name");

    if (fileName.isEmpty())
      fileName = "SwitchNest_Config";

    server.sendHeader("Content-Disposition",
                      "attachment; filename=\"" + fileName + ".json\"");

    server.send(200, "application/json", json);
  });
  server.on("/config/import", HTTP_POST, []() {
    if (!checkLogin())
      return;

    String json = server.arg("plain");

    if (json.length() == 0) {
      server.send(400, "application/json",
                  "{\"success\":false,\"message\":\"Empty Body\"}");
      return;
    }

    if (!PreferencesManager::validateConfiguration(json)) {
      server.send(400, "application/json",
                  "{\"success\":false,\"message\":\"Invalid Configuration\"}");
      return;
    }

    if (!PreferencesManager::importConfiguration(json)) {
      server.send(500, "application/json",
                  "{\"success\":false,\"message\":\"Import Failed\"}");
      return;
    }

    server.send(200, "application/json",
                "{\"success\":true,\"message\":\"Configuration Imported\"}");
    delay(2000);
    ESP.restart();
  });
  server.on("/restart", HTTP_GET, []() {
    if (!checkLogin())
      return;

    server.send(200, "text/html", "<h2>Restarting Device...</h2>");

    delay(1000);

    ESP.restart();
  });

  server.on("/reset", HTTP_GET, []() {
    if (!checkLogin())
      return;

    PreferencesManager::factoryReset();

    server.send(200, "text/html",
                "<h2>Factory Reset Complete.<br>Restarting Device...</h2>");

    delay(2000);

    ESP.restart();
  });

  server.on("/wifi/scan", HTTP_GET, []() {
    // Setup mode (device configured nahi) mein bina login ke scan allowed —
    // setup page isi pe depend karta hai
    if (PreferencesManager::isConfigured() && !checkLogin())
      return;

    int n = WiFi.scanNetworks();

    String json = "[";

    bool first = true;

    for (int i = 0; i < n; i++) {
      String ssid = WiFi.SSID(i);

      if (ssid == "")
        continue;

      bool duplicate = false;

      for (int j = 0; j < i; j++) {
        if (WiFi.SSID(j) == ssid) {
          duplicate = true;
          break;
        }
      }

      if (duplicate)
        continue;

      if (!first)
        json += ",";

      first = false;

      json += "{";
      json += "\"ssid\":\"" + ssid + "\",";
      json += "\"rssi\":" + String(WiFi.RSSI(i));
      json += "}";
    }

    json += "]";

    server.send(200, "application/json", json);
  });

  server.on("/ota/check", HTTP_GET, []() {
    if (!checkLogin())
      return;

    OTAManager::checkUpdate();

    server.send(200, "text/plain", "OK");
  });

  server.on("/ota/update", HTTP_POST, []() {
    if (!checkLogin())
      return;

    server.send(200, "application/json",
                "{\"success\":true,\"message\":\"OTA Started\"}");

    delay(100);

    OTAManager::startUpdate();
  });

  // Dashboard se firmware URL save karo (NVS mein persist — default check URL
  // ban jata hai)
  server.on("/ota/seturl", HTTP_POST, []() {
    if (!checkLogin())
      return;

    String url = server.arg("url");
    url.trim();

    // Empty URL = clear karo (default OTA_CHECK_URL wapas)
    PreferencesManager::saveOTAURL(url);

    String msg = url.isEmpty()
                     ? "OTA URL cleared — default check URL wapas"
                     : "OTA URL saved — ab Check Update isi URL se hoga";

    String json = "{\"success\":true,\"message\":\"";
    json += msg;
    json += "\"}";

    server.send(200, "application/json", json);
  });

  // Seedha .bin URL se update — ghar pe installed device ko kahin se bhi update
  // karne ke liye
  server.on("/ota/update-url", HTTP_POST, []() {
    if (!checkLogin())
      return;

    String url = server.arg("url");
    url.trim();

    if (url.isEmpty()) {
      server.send(200, "application/json",
                  "{\"success\":false,\"message\":\"URL empty\"}");
      return;
    }

    server.send(200, "application/json",
                "{\"success\":true,\"message\":\"OTA Started from URL — device "
                "restart hogi\"}");

    delay(100);

    OTAManager::startUpdateFromURL(url);
  });

  server.on("/ota/status", HTTP_GET, []() {
    if (!checkLogin())
      return;

    String json = "{ ";

    json += "\"current\":\"";
    json += OTAManager::getCurrentVersion();
    json += "\",";

    json += "\"latest\":\"";
    json += OTAManager::getLatestVersion();
    json += "\",";

    json += "\"progress\":";
    json += String(OTAManager::getProgress());
    json += ",";

    json += "\"status\":\"";
    json += OTAManager::getStatus();
    json += "\",";

    json += "\"releaseNotes\":\"";
    json += OTAManager::getReleaseNotes();
    json += "\",";

    json += "\"available\":";
    json += OTAManager::isUpdateAvailable() ? "true" : "false";

    json += "}";

    server.send(200, "application/json", json);
  });

  // Session cookie ko request headers mein collect karne ke liye zaroori hai
  // (ESP32 WebServer default mein sirf Authorization header collect karta hai)
  const char *headerKeys[] = {"Cookie"};
  server.collectHeaders(headerKeys, 1);

  // Shared UI resources (glassmorphism design system + theme JS)
  server.on("/style.css", HTTP_GET,
            []() { server.send(200, "text/css", STYLE_CSS); });
  server.on("/app.js", HTTP_GET,
            []() { server.send(200, "application/javascript", APP_JS); });

  server.begin();

  Logger::success("Web Server Started");
}

void update() { server.handleClient(); }

} // namespace WebServerManager