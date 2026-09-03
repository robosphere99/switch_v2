#include "core/MqttManager.h"
#include "Config.h"
#include "core/ApiManager.h"
#include "core/BoardManager.h"
#include "core/RelayManager.h"
#include "core/LedManager.h"
#include "preferences/PreferencesManager.h"
#include <ArduinoJson.h>
#include <PubSubClient.h>
#include <WiFi.h>

extern void processSerialCommand(const String &line, bool fromMqtt = false);

namespace MqttManager {

static WiFiClient espClient;
static PubSubClient mqttClient(espClient);

static unsigned long lastReconnectAttempt = 0;
static const unsigned long RECONNECT_INTERVAL = 5000;
static unsigned long lastStatePublish = 0;
static const unsigned long STATE_PUBLISH_INTERVAL = 30000; // Backup state push

String parseHostFromUrl(String url) {
  url.replace("http://", "");
  url.replace("https://", "");
  int slashIndex = url.indexOf('/');
  if (slashIndex != -1) {
    url = url.substring(0, slashIndex);
  }
  int colonIndex = url.indexOf(':');
  if (colonIndex != -1) {
    url = url.substring(0, colonIndex);
  }
  return url;
}

void callback(char *topic, byte *payload, unsigned int length) {
  Serial.print("[MQTT] Message arrived on topic: ");
  Serial.println(topic);

  String message;
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.print("[MQTT] Payload: ");
  Serial.println(message);

  String mac = WiFi.macAddress();
  mac.replace(":", "");
  mac.toLowerCase();
  String cmdTopic = "sn/" + mac + "/cmd";

  if (String(topic) == cmdTopic) {
    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, message);
    if (error) {
      Serial.print("[MQTT] Failed to parse command JSON: ");
      Serial.println(error.c_str());
      return;
    }

    if (doc.containsKey("type") && doc["type"] == "set_led") {
      bool enabled = doc["enabled"] | true;
      LedManager::setUserEnabled(enabled);
      Serial.print("[MQTT] LED state set to: ");
      Serial.println(enabled);
      return;
    }

    if (doc.containsKey("commands")) {
      JsonArray commands = doc["commands"].as<JsonArray>();
      int applied = 0;
      for (JsonObject cmd : commands) {
        int commandId = cmd["id"];
        int channel = cmd["ch"] | -1;
        const char *command = cmd["action"] | "";

        bool state = false;
        bool known = false;

        if (strcmp(command, "set_status:on") == 0) {
          state = true;
          known = true;
        } else if (strcmp(command, "set_status:off") == 0) {
          state = false;
          known = true;
        } else if (strcmp(command, "set_wifi") == 0) {
          const char *newSsid = cmd["ssid"] | "";
          const char *newPass = cmd["pass"] | "";
          if (strlen(newSsid) > 0) {
            PreferencesManager::saveWiFi(String(newSsid), String(newPass));
            Serial.println(
                "[MQTT] Remote WiFi update received! Rebooting soon...");
            ApiManager::ackCommand(commandId, true);
            delay(1000); // Give time for ack to flush
            ESP.restart();
          }
        } else if (strcmp(command, "rotate_console_pass") == 0) {
          const char *newPass = cmd["newPass"] | "";
          if (strlen(newPass) > 0) {
            PreferencesManager::saveConsolePassword(String(newPass));
            Serial.println("[MQTT] Zero-Trust Password Rotated Successfully.");
            ApiManager::ackCommand(commandId, true);
          }
        }

        if (known && channel > 0) {
          int relay = channel - 1;
          RelayManager::setState(relay, state);
          applied++;
        }

        ApiManager::ackCommand(commandId, true);
      }

      if (applied > 0) {
        publishState();
      }
    }

    if (doc.containsKey("names")) {
      JsonArray namesArr = doc["names"].as<JsonArray>();
      uint8_t idx = 0;
      for (const char *n : namesArr) {
        if (idx < BoardManager::getRelayCount()) {
          BoardManager::setRelayName(idx, n ? String(n) : "");
        }
        idx++;
      }
      Serial.println("[MQTT] Received device name mappings");
    }
  } else if (String(topic) == "sn/" + mac + "/term_cmd") {
    // Process terminal commands via main serial command processor
    String cmd = message;
    cmd.trim();
    publishLog(">> " + cmd);
    processSerialCommand(cmd, true);
  }
}

void publishLog(const String& msg) {
  if (!mqttClient.connected()) return;
  String mac = WiFi.macAddress();
  mac.replace(":", "");
  mac.toLowerCase();
  String topic = "sn/" + mac + "/log";
  
  // Format msg nicely with uptime maybe?
  String logPayload = "[" + String(millis()) + "] " + msg;
  mqttClient.publish(topic.c_str(), logPayload.c_str());
}

static String
    mqttHost; // Fix dangling pointer: PubSubClient needs persistent buffer

void begin() {
  String serverUrl = PreferencesManager::getServerURL();
  if (serverUrl.isEmpty())
    return;

  mqttHost = parseHostFromUrl(serverUrl);
  if (mqttHost.isEmpty())
    return;

  Serial.print("[MQTT] Configuring broker: ");
  Serial.print(mqttHost);
  Serial.println(":1883");

  mqttClient.setServer(mqttHost.c_str(), 1883);
  mqttClient.setCallback(callback);
}

bool publishState(bool forceTelemetry) {
  if (!mqttClient.connected())
    return false;

  String mac = WiFi.macAddress();
  mac.replace(":", "");
  mac.toLowerCase();

  StaticJsonDocument<256> doc;
  JsonArray states = doc.createNestedArray("states");
  for (uint8_t i = 0; i < BoardManager::getRelayCount(); i++) {
    states.add(RelayManager::getState(i) ? 1 : 0);
  }

  if (forceTelemetry) {
    doc["fw"] = FIRMWARE_VERSION;
    doc["ip"] = WiFi.localIP().toString();
    doc["ssid"] = WiFi.SSID();
    doc["model"] = BoardManager::getModelCode();
  }

  String payload;
  serializeJson(doc, payload);

  String topic = "sn/" + mac + "/state";

  bool ok = mqttClient.publish(topic.c_str(), payload.c_str());
  if (ok) {
    Serial.printf("[MQTT] Sent payload to %s: %s\n", topic.c_str(),
                  payload.c_str());
  }
  return ok;
}

bool reconnect() {
  if (WiFi.status() != WL_CONNECTED)
    return false;
  if (mqttClient.connected())
    return true;

  String serialCode = PreferencesManager::getSerialCode();
  String apiKey = PreferencesManager::getApiKey();
  String serverUrl = PreferencesManager::getServerURL();
  String host = parseHostFromUrl(serverUrl);

  if (serialCode.isEmpty() || apiKey.isEmpty() || host.isEmpty()) {
    return false;
  }

  String mac = WiFi.macAddress();
  mac.replace(":", "");
  mac.toLowerCase();

  // Client ID unique based on MAC
  String clientId = "sn-" + mac;
  String willTopic = "sn/" + mac + "/online";

  Serial.print("[MQTT] Connecting as ");
  Serial.print(serialCode);
  Serial.println("...");

  if (mqttClient.connect(clientId.c_str(), serialCode.c_str(), apiKey.c_str(),
                         willTopic.c_str(), 1, true, "0")) {
    Serial.println("[MQTT] Connected!");

    // Publish birth message
    mqttClient.publish(willTopic.c_str(), "1", true);

    static bool isFirstConnect = true;
    if (isFirstConnect) {
      publishLog("======================================");
      publishLog("Device Booted up & Connected!");
      publishLog("Firmware: v" + String(FIRMWARE_VERSION));
      publishLog("IP: " + WiFi.localIP().toString());
      publishLog("======================================");
      isFirstConnect = false;
    } else {
      publishLog("Device reconnected to MQTT.");
    }

    // Subscribe to commands
    String cmdTopic = "sn/" + mac + "/cmd";
    mqttClient.subscribe(cmdTopic.c_str(), 1);

    // Subscribe to terminal commands
    String termTopic = "sn/" + mac + "/term_cmd";
    mqttClient.subscribe(termTopic.c_str(), 1);

    // Immediately sync state on connect with full attendance telemetry
    publishState(true);
    return true;
  } else {
    Serial.print("[MQTT] Connect failed, rc=");
    Serial.println(mqttClient.state());
    return false;
  }
}

void loop() {
  String serverUrl = PreferencesManager::getServerURL();
  if (serverUrl.isEmpty() || WiFi.status() != WL_CONNECTED)
    return;

  if (!mqttClient.connected()) {
    unsigned long now = millis();
    if (now - lastReconnectAttempt > RECONNECT_INTERVAL) {
      lastReconnectAttempt = now;
      if (reconnect()) {
        lastReconnectAttempt = 0;
      }
    }
  } else {
    mqttClient.loop();

    // Periodic heartbeat publish (No telemetry to save bandwidth)
    unsigned long now = millis();
    if (now - lastStatePublish > STATE_PUBLISH_INTERVAL) {
      lastStatePublish = now;
      publishState(false);
    }
  }
}

bool isConnected() { return mqttClient.connected(); }

} // namespace MqttManager
