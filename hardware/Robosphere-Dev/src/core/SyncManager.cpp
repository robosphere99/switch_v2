
#include "core/SyncManager.h"
#include "core/ApiManager.h"
#include "core/LedManager.h"
#include "core/Logger.h"
#include "core/OTAManager.h"
#include "core/RelayManager.h"
#include "preferences/PreferencesManager.h"
#include <Arduino.h>
#include <WiFi.h>

namespace SyncManager {

static unsigned long lastSync = 0;

// Heartbeat — device online report + server-push OTA check.
// Admin ne is device ko update push kiya hai to heartbeat response me
// firmware URL aata hai aur hum update turant start kar dete hain.
static unsigned long lastHeartbeat = 0;

static const unsigned long HEARTBEAT_MS = 30000;

// ==================================================
// Command poller — dedicated task (core 0)
//
// Web/API se kiya toggle pehle 5s wale sync gate ke andar poll hota tha
// (worst case 5s+ lag). Ab command queue apne alag task se LONG-POLL hota
// hai: server response ko hold karta hai jab tak command na aaye, to web
// toggle se relay pe click ~1s ke andar ho jata hai. Main loop (web panel,
// physical switches) kabhi block nahi hota — task core 0 pe chalta hai,
// Arduino loop core 1 pe.
// ==================================================
static TaskHandle_t commandTaskHandle = nullptr;

static void commandPollTask(void *param) {
  for (;;) {
    // WiFi connected + server configured ho tabhi poll karo.
    if (WiFi.status() == WL_CONNECTED &&
        !PreferencesManager::getServerURL().isEmpty() &&
        !PreferencesManager::getApiKey().isEmpty()) {
      // Long-poll (~20s max hold) — command aate hi return, apply + ack.
      // Task hai isliye blocking se loop freeze nahi hota.
      ApiManager::downloadCommands();
    }
    vTaskDelay(pdMS_TO_TICKS(200));
  }
}

bool begin() {
  lastSync = millis();
  lastHeartbeat = millis();

  // Command polling — core 0 pe pinned task (Arduino loop core 1 pe hai).
  // 16KB stack (loop task ke barabar) — TLS handshake + JSON parse safe rahega.
  if (commandTaskHandle == nullptr) {
    xTaskCreatePinnedToCore(commandPollTask, "cmdPoll", 16384, NULL, 1,
                            &commandTaskHandle, 0);
  }

  return true;
}

void update() {
  if (WiFi.status() != WL_CONNECTED)
    return;

  // Remote server (HTTPS) se har download ~1.1s leta hai — har second
  // sync karne par loop almost continuously block hota hai aur web UI
  // (dashboard, toggles) laggy feel hota hai. 5s interval balance hai:
  // server-side changes 5s ke andar dikh jaate hain, loop 22% se
  // zyada block nahi hota.
  if (millis() - lastSync < 5000)
    return;

  lastSync = millis();

  // Server configured hai ya nahi?
  if (PreferencesManager::getServerURL().isEmpty() ||
      PreferencesManager::getApiKey().isEmpty()) {
    return;
  }

  if (!ApiManager::downloadDevices()) {
    Logger::warning("Device Sync Failed");
  }

  // Command queue polling ab dedicated commandPollTask (core 0) se hota
  // hai — long-poll ke saath near-instant delivery. Main loop sirf device
  // sync + heartbeat karta hai.

  // Heartbeat + OTA push check (har 30s). Server ab IP / firmware /
  // relay states track karta hai aur admin push kare to update trigger.
  if (millis() - lastHeartbeat >= HEARTBEAT_MS) {
    lastHeartbeat = millis();

    String otaUrl;
    if (ApiManager::heartbeat(otaUrl) && !otaUrl.isEmpty()) {
      Logger::info(("Server-push OTA -> " + otaUrl).c_str());
      OTAManager::startUpdateFromURL(otaUrl);
    }
  }
}

} // namespace SyncManager