#include <HTTPUpdate.h>
#include "core/OTAManager.h"

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#include "Config.h"
#include "preferences/PreferencesManager.h"
#include "core/MappingManager.h"

namespace {
enum OTAState {
  OTA_IDLE,
  OTA_CHECKING,
  OTA_AVAILABLE,
  OTA_DOWNLOADING,
  OTA_INSTALLING,
  OTA_SUCCESS,
  OTA_FAILED
};

OTAState state = OTA_IDLE;

bool updateAvailable = false;

bool updating = false;

int progress = 0;

static String lastError = "";

String latestVersion = "";

String releaseNotes = "";

String firmwareURL = "";

String status = "Idle";

// Server ko har 5% par progress report hota hai (OTA stream block na ho)
static int lastReportedProgress = -1;
}

namespace OTAManager {

bool begin() {
  state = OTA_IDLE;

  updateAvailable = false;

  updating = false;

  progress = 0;

  latestVersion = FIRMWARE_VERSION;

  releaseNotes = "";

  firmwareURL = "";

  status = "Ready";

  return true;
}

void update() {
  // Future:
  // Progress Monitor
  // Async Download
}

bool checkUpdate() {
  state = OTA_CHECKING;

  status = "Checking";

  // OTA URL pehle NVS se (agar user ne set kiya hai), warna default constant
  String checkURL = PreferencesManager::getOTAURL();

  if (checkURL.isEmpty())
    checkURL = OTA_CHECK_URL;

  if (checkURL.isEmpty()) {
    // Koi OTA check URL configured nahi — server-push (heartbeat) hi kaafi hai.
    // Boot pe bekar HTTP attempt na karo.
    status = "Server-push only";
    state = OTA_IDLE;
    return false;
  }

  HTTPClient http;

  http.setTimeout(OTA_TIMEOUT);

  http.begin(checkURL);

  int httpCode = http.GET();

  if (httpCode != HTTP_CODE_OK) {
    status = "Check Failed";

    state = OTA_FAILED;

    http.end();

    return false;
  }

  String payload = http.getString();

  http.end();

  DynamicJsonDocument doc(2048);

  DeserializationError error =
    deserializeJson(doc, payload);

  if (error) {
    status = "JSON Error";

    state = OTA_FAILED;

    return false;
  }

  latestVersion =
    doc["version"].as<String>();

  firmwareURL =
    doc["url"].as<String>();

  releaseNotes =
    doc["releaseNotes"].as<String>();

  if (latestVersion != FIRMWARE_VERSION) {
    updateAvailable = true;

    state = OTA_AVAILABLE;

    status = "Update Available";
  } else {
    updateAvailable = false;

    state = OTA_IDLE;

    status = "Already Latest";
  }

  return true;
}

// Fire-and-forget progress report to the server (Admin OTA tab live bar).
// Kabhi OTA download stream ko block nahi karna chahiye — short timeout + no wait.
static void reportProgress(int pct, const char *otaStatus)
{
    if (WiFi.status() != WL_CONNECTED)
        return;

    String serverURL = PreferencesManager::getServerURL();
    String apiKey = PreferencesManager::getApiKey();

    if (serverURL.isEmpty() || apiKey.isEmpty())
        return;

    int deviceId = MappingManager::getDeviceIdByRelay(0);
    if (deviceId < 0)
        return;

    static WiFiClient plainClient;
    static WiFiClientSecure secureClient;
    HTTPClient http;
    http.setTimeout(2000);
    if (serverURL.startsWith("https://"))
    {
        secureClient.setInsecure();
        http.begin(secureClient, serverURL + "/api/device/ota-progress");
    }
    else
    {
        http.begin(serverURL + "/api/device/ota-progress");
    }
    http.addHeader("Content-Type", "application/x-www-form-urlencoded");

    String body = "api_key=" + apiKey;
    body += "&device_id=" + String(deviceId);
    body += "&progress=" + String(pct);
    body += "&status=" + String(otaStatus);

    int httpCode = http.POST(body);
    http.end();

    (void)httpCode;
}

bool startUpdate() {
  if (firmwareURL.isEmpty()) {
    status = "No Firmware URL";

    return false;
  }

  updating = true;

  progress = 0;

  state = OTA_DOWNLOADING;

  lastReportedProgress = -1;

  reportProgress(0, "downloading");

  status = "Downloading";

  // HTTPS URL ke liye secure client (setInsecure — no cert bundle), warna plain
  static WiFiClient plainOtaClient;
  static WiFiClientSecure secureOtaClient;
  bool useSecure = firmwareURL.startsWith("https://");
  if (useSecure)
    secureOtaClient.setInsecure();
  WiFiClient &client = useSecure ? (WiFiClient &)secureOtaClient : (WiFiClient &)plainOtaClient;

  httpUpdate.onStart([]() {
    Serial.println("OTA Started");
  });

  httpUpdate.onProgress([](int current, int total) {
    if (total > 0) {
      progress = (current * 100) / total;

      // Har 5% (ya 100%) par server ko report — throttled, OTA stream ko block nahi karna.
      if (progress - lastReportedProgress >= 5 || progress >= 100) {
        lastReportedProgress = progress;

        reportProgress(progress, "downloading");
      }

      Serial.printf(
        "Progress : %d%%\n",
        progress);
    }
  });

  httpUpdate.onEnd([]() {
    Serial.println("OTA Finished");

    reportProgress(100, "complete");
  });

  httpUpdate.onError([](int error) {
    Serial.printf(
      "OTA Error : %d\n",
      error);

    reportProgress(progress, "failed");
  });

  t_httpUpdate_return result =
    httpUpdate.update(client, firmwareURL);

  updating = false;

  switch (result) {
    case HTTP_UPDATE_FAILED:
      lastError = httpUpdate.getLastErrorString();
      Serial.println("===== OTA FAILED =====");

      Serial.print("Error Code : ");
      Serial.println(httpUpdate.getLastError());

      Serial.print("Error : ");
      Serial.println(httpUpdate.getLastErrorString());

      status = httpUpdate.getLastErrorString();

      updating = false;

      return false;

    case HTTP_UPDATE_NO_UPDATES:

      Serial.println("===== NO UPDATE =====");

      updating = false;

      status = "No Update";

      return false;

    case HTTP_UPDATE_OK:

      Serial.println("===== OTA SUCCESS =====");

      updating = false;

      status = "Success";

      // IMPORTANT: Update complete hone ke baad restart zaroori hai,
      // warna device purana firmware chalata rahega aur naya kabhi boot nahi hoga.
      Serial.println("OTA Complete. Restarting in 1 second...");

      delay(1000);

      ESP.restart();

      return true;
  }

  return false;
}

bool startUpdateFromURL(const String &url) {
  if (url.isEmpty()) {
    status = "No Firmware URL";

    return false;
  }

  firmwareURL = url;

  return startUpdate();
}

bool isUpdateAvailable() {
  return updateAvailable;
}

bool isUpdating() {
  return updating;
}

int getProgress() {
  return progress;
}

String getCurrentVersion() {
  return FIRMWARE_VERSION;
}

String getLatestVersion() {
  return latestVersion;
}

String getReleaseNotes() {
  return releaseNotes;
}

String getStatus() {
  return status;
}

String getFirmwareURL()
{
    return firmwareURL;
}

String getLastError()
{
    return lastError;
}

OTAState getState()
{
    return state;
}

}