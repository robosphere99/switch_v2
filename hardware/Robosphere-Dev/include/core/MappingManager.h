#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>

namespace MappingManager
{
    bool begin();

    bool load();

    bool save();

    void setMapping(uint8_t channel, int deviceId);

    int getMapping(uint8_t channel);

    int getMappedCount();

    int getRelayByDeviceId(int deviceId);
    
    int getDeviceIdByRelay(uint8_t relay);

    String exportMapping();

    bool importMapping(const JsonArray &mappingArray);
}