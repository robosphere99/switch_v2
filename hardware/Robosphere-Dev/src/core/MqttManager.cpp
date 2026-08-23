#include "core/MqttManager.h"
#include "Config.h"
#include "core/ApiManager.h"
#include "core/BoardManager.h"
#include "core/RelayManager.h"
#include "preferences/PreferencesManager.h"
#include <ArduinoJson.h>
#include <PubSubClient.h>
#include <WiFi.h>


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
        }

        if (known && channel > 0) {
          int relay = channel - 1;
          RelayManager::setState(relay, state);
          applied++;
        }

        // Ack via HTTP or MQTT? The backend still has api/device/commands/ack
        // but since states sync over MQTT instantly, the backend might trace
        // it. We'll still HTTP ack for now to guarantee removal from DB queue.
        ApiManager::ackCommand(commandId, true);
      }

      if (applied > 0) {
        // Immediately publish new state after command apply
        publishState();
      }
    }
  }
}

void begin() {
  String serverUrl = PreferencesManager::getServerURL();
  if (serverUrl.isEmpty())
    return;

  String host = parseHostFromUrl(serverUrl);
  if (host.isEmpty())
    return;

  Serial.print("[MQTT] Configuring broker: ");
  Serial.print(host);
  Serial.println(":1883");

  mqttClient.setServer(host.c_str(), 1883);
  mqttClient.setCallback(callback);
}

bool publishState() {
  if (!mqttClient.connected())
    return false;

  String mac = WiFi.macAddress();
  mac.replace(":", "");
  mac.toLowerCase();

  DynamicJsonDocument doc(1024);
  JsonArray states = doc.createNestedArray("states");
  for (int ch = 0; ch < BoardManager::getRelayCount(); ch++) {
    states.add(RelayManager::getState(ch) ? 1 : 0);
  }
  doc["fw"] = FIRMWARE_VERSION;
  doc["ip"] = WiFi.localIP().toString();
  doc["ssid"] = WiFi.SSID();
  doc["model"] = BoardManager::getModelCode();

  String payload;
  serializeJson(doc, payload);

  String topic = "sn/" + mac + "/state";
  return mqttClient.publish(topic.c_str(), payload.c_str());
}

bool reconnect() {
  if (WiFi.status() != WL_CONNECTED)
    return false;
  if (mqttClient.connected())
    return true;

  String serialCode = PreferencesManager::getSerialCode();
  String apiKey = PreferencesManager::getApiKey();

  if (serialCode.isEmpty() || apiKey.isEmpty()) {
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

    // Subscribe to commands
    String cmdTopic = "sn/" + mac + "/cmd";
    mqttClient.subscribe(cmdTopic.c_str(), 1);

    // Immediately sync state on connect
    publishState();
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

    // Periodic heartbeat publish
    unsigned long now = millis();
    if (now - lastStatePublish > STATE_PUBLISH_INTERVAL) {
      lastStatePublish = now;
      publishState();
    }
  }
}

bool isConnected() { return mqttClient.connected(); }

} // namespace MqttManager
