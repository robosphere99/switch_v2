#include "core/MappingManager.h"
#include <Arduino.h>
#include <ArduinoJson.h>
#include "core/BoardManager.h"
#include "preferences/PreferencesManager.h"

static int relayMapping[8];

namespace MappingManager
{

bool begin()
{
    load();
    return true;
}

void setMapping(uint8_t channel, int deviceId)
{
    if(channel >= BoardManager::getRelayCount())
        return;

    relayMapping[channel] = deviceId;
}

int getMapping(uint8_t channel)
{
    if(channel >= BoardManager::getRelayCount())
        return -1;

    return relayMapping[channel];
}

bool save()
{
    Serial.println("========== SAVE ==========");

    for(uint8_t i = 0; i < BoardManager::getRelayCount(); i++)
    {
        String key = "map" + String(i);

        Serial.print(key);
        Serial.print(" = ");
        Serial.println(relayMapping[i]);

        PreferencesManager::putInt(key.c_str(), relayMapping[i]);
    }

    return true;
}

bool load()
{
    Serial.println("========== LOAD ==========");

    for(uint8_t i = 0; i < BoardManager::getRelayCount(); i++)
    {
        String key = "map" + String(i);

        relayMapping[i] =
            PreferencesManager::getInt(key.c_str(), -1);

        Serial.print(key);
        Serial.print(" = ");
        Serial.println(relayMapping[i]);
    }

    return true;
}
int getMappedCount()
{
    int count = 0;

    for(uint8_t i = 0; i < BoardManager::getRelayCount(); i++)
    {
        if(relayMapping[i] != -1)
        {
            count++;
        }
    }

    return count;
}
int getRelayByDeviceId(int deviceId)
{
    for(uint8_t i = 0; i < BoardManager::getRelayCount(); i++)
    {
        if(relayMapping[i] == deviceId)
        {
            return i;
        }
    }

    return -1;
}
int getDeviceIdByRelay(uint8_t relay)
{
    if(relay >= BoardManager::getRelayCount())
        return -1;

    return relayMapping[relay];
}

bool importMapping(const JsonArray &mappingArray)
{
    if(mappingArray.size() != BoardManager::getRelayCount())
        return false;

    for(uint8_t i = 0; i < BoardManager::getRelayCount(); i++)
    {
        relayMapping[i] = mappingArray[i];
    }

    save();

    return true;
}

String exportMapping()
{
    DynamicJsonDocument doc(512);

    JsonArray mapping = doc.to<JsonArray>();

    for(uint8_t i = 0; i < BoardManager::getRelayCount(); i++)
    {
        mapping.add(MappingManager::getMapping(i));
    }

    String json;

    serializeJson(mapping, json);

    return json;
}



}