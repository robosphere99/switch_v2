#include "core/StatusManager.h"

#include <ArduinoJson.h>
#include <WiFi.h>

#include "core/BoardManager.h"
#include "core/RelayManager.h"
#include "core/WiFiManager.h"


namespace StatusManager {

String getJson() {
  DynamicJsonDocument doc(1536);

  bool connected = (WiFi.status() == WL_CONNECTED);

  doc["wifi"] = connected;

  doc["ssid"] = connected ? WiFi.SSID() : "";

  // Station connected nahi toh AP IP dikhao (user ko pata ho kahan se
  // connect karna hai)
  doc["ip"] = WiFiManager::getIP();

  // Fallback AP (WiFi fail) vs setup AP — dashboard notice ke liye
  doc["apMode"] = !connected && WiFiManager::isSetupAccessPoint();

  // Dual-mode (AP + STA ek saath) — AP IP/SSID + mDNS hostname
  doc["dualMode"] = WiFiManager::isDualMode();

  doc["apIp"] = WiFiManager::getAPIP();

  doc["apSsid"] = WiFiManager::getAPSSID();

  doc["hostname"] = WiFiManager::getHostname();

  doc["rssi"] = connected ? WiFi.RSSI() : 0;

  doc["mappedRelays"] = BoardManager::getRelayCount();
  JsonArray relays = doc["relays"].to<JsonArray>();

  for (int i = 0; i < BoardManager::getRelayCount(); i++) {
    relays.add(RelayManager::getState(i));
  }

  String json;

  serializeJson(doc, json);

  return json;
}

} // namespace StatusManager