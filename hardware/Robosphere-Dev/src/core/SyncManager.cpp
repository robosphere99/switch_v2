#include "core/DeviceManager.h"
#include "core/MappingManager.h"
#include "core/RelayManager.h"
#include "core/SyncManager.h"
#include <WiFi.h>
#include <Arduino.h>
#include "core/LedManager.h"
#include "core/ApiManager.h"
#include "core/Logger.h"
#include "core/OTAManager.h"
#include "preferences/PreferencesManager.h"
namespace SyncManager {

static unsigned long lastSync = 0;

// Command queue polling — device sync (5s) se alag, thoda faster taaki
// web/API se kiya toggle jaldi se relay pe lage.
static unsigned long lastCommandCheck = 0;

// Heartbeat — device online report + server-push OTA check.
// Admin ne is device ko update push kiya hai to heartbeat response me
// firmware URL aata hai aur hum update turant start kar dete hain.
static unsigned long lastHeartbeat = 0;

static const unsigned long COMMAND_CHECK_MS = 3000;
static const unsigned long HEARTBEAT_MS = 30000;

bool begin() {
  lastSync = millis();
  lastCommandCheck = millis();
  lastHeartbeat = millis();

  return true;
}

void update()
{
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
        PreferencesManager::getApiKey().isEmpty())
    {
        return;
    }

    bool ok = ApiManager::downloadDevices();

    if (ok)
    {
        int ledDevice = PreferencesManager::getStatusLedMapping();
        for (int i = 0; i < DeviceManager::getCount(); i++)
        {
            Device* device = DeviceManager::getDevice(i);

            if (device == nullptr)
                continue;


if(device->id == ledDevice)
{
    if(strcmp(device->status,"on")==0)
    {
        LedManager::enable();
    }
    else
    {
        LedManager::disable();
    }
}

            int relay = MappingManager::getRelayByDeviceId(device->id);

            if (relay == -1)
                continue;

            if (strcmp(device->status, "on") == 0)
            {
                RelayManager::on(relay);
            }
            else
            {
                RelayManager::off(relay);
            }
        }
    }
    else
    {
        Logger::warning("Device Sync Failed");
    }

    // Command queue (v2) — web/API se aaye pending commands ko relay pe
    // apply karke ack karo. downloadCommands() apne andar server/WiFi
    // guard karta hai, isliye yahan sirf interval check kaafi hai.
    if (millis() - lastCommandCheck >= COMMAND_CHECK_MS)
    {
        lastCommandCheck = millis();
        ApiManager::downloadCommands();
    }

    // Heartbeat + OTA push check (har 30s). Server ab IP / firmware /
    // relay states track karta hai aur admin push kare to update trigger.
    if (millis() - lastHeartbeat >= HEARTBEAT_MS)
    {
        lastHeartbeat = millis();

        String otaUrl;
        if (ApiManager::heartbeat(otaUrl) && !otaUrl.isEmpty())
        {
            Logger::info(("Server-push OTA -> " + otaUrl).c_str());
            OTAManager::startUpdateFromURL(otaUrl);
        }
    }
}

}