#include "core/SystemManager.h"

#include <WiFi.h>
#include <ESP.h>

#include "Config.h"

namespace SystemManager
{

String getFirmwareVersion()
{
    return FIRMWARE_VERSION;
}

String getIPAddress()
{
    return WiFi.localIP().toString();
}

String getMacAddress()
{
    return WiFi.macAddress();
}

int getRSSI()
{
    return WiFi.RSSI();
}

uint32_t getFreeHeap()
{
    return ESP.getFreeHeap();
}

uint32_t getFlashSize()
{
    return ESP.getFlashChipSize();
}

uint32_t getSketchSize()
{
    return ESP.getSketchSize();
}

uint32_t getCpuFrequency()
{
    return ESP.getCpuFreqMHz();
}

String getChipModel()
{
    return ESP.getChipModel();
}

uint32_t getChipRevision()
{
    return ESP.getChipRevision();
}

unsigned long getUptime()
{
    return millis()/1000;
}

}