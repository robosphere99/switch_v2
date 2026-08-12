#pragma once

#include <Arduino.h>

namespace SystemManager
{
    String getFirmwareVersion();

    String getIPAddress();

    String getMacAddress();

    int getRSSI();

    uint32_t getFreeHeap();

    uint32_t getFlashSize();

    uint32_t getSketchSize();

    uint32_t getCpuFrequency();

    String getChipModel();

    uint32_t getChipRevision();

    unsigned long getUptime();
}