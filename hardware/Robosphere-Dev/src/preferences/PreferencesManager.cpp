#include "preferences/PreferencesManager.h"
#include "Config.h"
#include <ArduinoJson.h>
#include <ESP.h>


Preferences preferences;

namespace PreferencesManager {

bool begin() { return preferences.begin(PREF_NAMESPACE, false); }

bool isConfigured() { return preferences.getBool(PREF_CONFIGURED, false); }

void setConfigured(bool status) {
  preferences.putBool(PREF_CONFIGURED, status);
}

void saveWiFi(const String &ssid, const String &password) {
  preferences.putString(PREF_WIFI_SSID, ssid);
  preferences.putString(PREF_WIFI_PASSWORD, password);
}

String getWiFiSSID() { return preferences.getString(PREF_WIFI_SSID, ""); }

String getWiFiPassword() {
  return preferences.getString(PREF_WIFI_PASSWORD, "");
}

void saveAdmin(const String &username, const String &password) {
  preferences.putString(PREF_ADMIN_USER, username);
  preferences.putString(PREF_ADMIN_PASSWORD, password);
}

String getAdminUsername() {
  String val = preferences.getString(PREF_ADMIN_USER, "");
  return val.isEmpty() ? DEFAULT_ADMIN_USER : val;
}

String getAdminPassword() {
  String val = preferences.getString(PREF_ADMIN_PASSWORD, "");
  return val.isEmpty() ? DEFAULT_ADMIN_PASSWORD : val;
}

void saveServer(const String &url, const String &apiKey) {
  preferences.putString(PREF_SERVER_URL, url);
  preferences.putString(PREF_API_KEY, apiKey);
}

String getServerURL() { return preferences.getString(PREF_SERVER_URL, ""); }

String getApiKey() { return preferences.getString(PREF_API_KEY, ""); }

void saveKeyInvalid(bool invalid) {
  preferences.putBool(PREF_KEY_INVALID, invalid);
}

bool isKeyInvalid() { return preferences.getBool(PREF_KEY_INVALID, false); }

void saveSerialCode(const String &code) {
  preferences.putString(PREF_SERIAL_CODE, code);
}

String getSerialCode() {
  if (!preferences.isKey(PREF_SERIAL_CODE))
    return "";
  return preferences.getString(PREF_SERIAL_CODE, "");
}

void saveModelCode(const String &code) {
  preferences.putString(PREF_MODEL_CODE, code);
}

String getModelCode() {
  if (!preferences.isKey(PREF_MODEL_CODE))
    return "";
  return preferences.getString(PREF_MODEL_CODE, "");
}

void saveOTAURL(const String &url) { preferences.putString(PREF_OTA_URL, url); }

String getOTAURL() {
  // isKey check taaki key exist na kare toh noisy NVS error na aaye
  if (!preferences.isKey(PREF_OTA_URL))
    return "";

  return preferences.getString(PREF_OTA_URL, "");
}

void saveAPName(const String &name) {
  preferences.putString(PREF_AP_NAME, name);
}

String getAPName() {
  if (!preferences.isKey(PREF_AP_NAME))
    return "";

  return preferences.getString(PREF_AP_NAME, "");
}

void saveAPPassword(const String &password) {
  preferences.putString(PREF_AP_PASSWORD, password);
}

String getAPPassword() {
  if (!preferences.isKey(PREF_AP_PASSWORD))
    return "";

  return preferences.getString(PREF_AP_PASSWORD, "");
}

void saveAPKeepEnabled(bool enabled) {
  preferences.putBool(PREF_AP_KEEP, enabled);
}

bool getAPKeepEnabled() {
  // Default true — WiFi connect hone ke baad bhi AP ON (dual mode)
  return preferences.getBool(PREF_AP_KEEP, true);
}

void putInt(const char *key, int value) { preferences.putInt(key, value); }

int getInt(const char *key, int defaultValue) {
  return preferences.getInt(key, defaultValue);
}

void factoryReset() {
  Serial.println("========================");
  Serial.println("FACTORY RESET STARTED");
  Serial.println("========================");

  // Serial = board ki lifetime identity — reset pe bhi wapas aata hai,
  // aur AP credentials serial-derived defaults pe restore hote hain
  // (hotspot naam SwitchNest-<serial>, password = serial key).
  String serial = getSerialCode();
  String model = getModelCode();

  preferences.clear();

  if (!serial.isEmpty()) {
    saveSerialCode(serial);
    saveModelCode(model);
    saveAPName("SwitchNest-" + serial);
    saveAPPassword(serial);
    Serial.println("Serial preserved (lifetime identity): " + serial);
    Serial.println("AP credentials restored (serial-derived)");
  }

  Serial.println("All Preferences Cleared");

  Serial.println("========================");
  Serial.println("FACTORY RESET COMPLETE");
  Serial.println("========================");
}

bool putBool(const char *key, bool value) {
  return preferences.putBool(key, value);
}

bool getBool(const char *key, bool defaultValue) {
  return preferences.getBool(key, defaultValue);
}
String exportConfiguration() {
  DynamicJsonDocument doc(2048);

  doc["configVersion"] = 1;

  JsonObject wifi = doc["wifi"].to<JsonObject>();
  wifi["ssid"] = getWiFiSSID();
  wifi["password"] = getWiFiPassword();

  JsonObject server = doc["server"].to<JsonObject>();
  server["url"] = getServerURL();
  server["apiKey"] = getApiKey();

  JsonObject admin = doc["admin"].to<JsonObject>();
  admin["username"] = getAdminUsername();
  admin["password"] = getAdminPassword();

  doc["serialCode"] = getSerialCode();
  doc["modelCode"] = getModelCode();

  JsonObject ota = doc["ota"].to<JsonObject>();
  ota["url"] = getOTAURL();

  JsonObject ap = doc["ap"].to<JsonObject>();
  ap["name"] = getAPName();
  ap["password"] = getAPPassword();
  ap["keepEnabled"] = getAPKeepEnabled();

  doc["switchMode"] = getSwitchMode();

  String json;
  serializeJsonPretty(doc, json);

  return json;
}
bool validateConfiguration(const String &json) {
  DynamicJsonDocument doc(2048);

  if (deserializeJson(doc, json))
    return false;

  return true;
}

bool importConfiguration(const String &json) {
  DynamicJsonDocument doc(2048);

  DeserializationError error = deserializeJson(doc, json);

  if (error)
    return false;

  // WiFi
  saveWiFi(doc["wifi"]["ssid"].as<String>(),
           doc["wifi"]["password"].as<String>());

  // Server
  saveServer(doc["server"]["url"].as<String>(),
             doc["server"]["apiKey"].as<String>());

  // Admin
  saveAdmin(doc["admin"]["username"].as<String>(),
            doc["admin"]["password"].as<String>());

  // OTA
  saveOTAURL(doc["ota"]["url"].as<String>());

  // AP name/password (backward compatible — purane configs mein chhota)
  if (doc["ap"]["name"].is<const char *>())
    saveAPName(doc["ap"]["name"].as<String>());

  if (doc["ap"]["password"].is<const char *>())
    saveAPPassword(doc["ap"]["password"].as<String>());

  // AP keep (backward compatible — purane configs mein default ON)
  if (doc["ap"]["keepEnabled"].is<bool>())
    saveAPKeepEnabled(doc["ap"]["keepEnabled"].as<bool>());

  // Switch Mode (backward compatible — purane configs mein default momentary)
  if (doc["switchMode"].is<int>())
    saveSwitchMode(doc["switchMode"].as<int>());

  setConfigured(true);
  return true;
}
void saveStatusLedMapping(int deviceId) {
  preferences.putInt(PREF_STATUS_LED_DEVICE_ID, deviceId);
}

int getStatusLedMapping() {
  return preferences.getInt(PREF_STATUS_LED_DEVICE_ID, -1);
}

void saveSwitchMode(int mode) { preferences.putInt(PREF_SWITCH_MODE, mode); }

void saveLedEnabled(bool enabled) {
  preferences.putBool("led_enabled", enabled);
}

bool getLedEnabled() { return preferences.getBool("led_enabled", true); }

int getSwitchMode() {
  return preferences.getInt(PREF_SWITCH_MODE, SWITCH_MODE_MOMENTARY);
}

} // namespace PreferencesManager