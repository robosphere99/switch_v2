#include "core/RelayManager.h"
#include "core/BoardManager.h"
#include "preferences/PreferencesManager.h"

static bool relayState[8];
static uint8_t savedBitmask = 0;
static bool nvsPending = false;
static unsigned long nvsCommitTime = 0;

// Mutex for multi-threaded safety between Core 0 and Core 1
static SemaphoreHandle_t relayMutex = nullptr;

static void lock()
{
    if (relayMutex != nullptr)
        xSemaphoreTake(relayMutex, portMAX_DELAY);
}

static void unlock()
{
    if (relayMutex != nullptr)
        xSemaphoreGive(relayMutex);
}

namespace RelayManager
{

uint8_t getStateBitmask()
{
    uint8_t mask = 0;
    for (uint8_t i = 0; i < BoardManager::getRelayCount(); i++)
    {
        if (relayState[i])
            mask |= (1 << i);
    }
    return mask;
}

void restoreFromNVS()
{
    savedBitmask = PreferencesManager::getRelayStates(0);
    uint8_t count = BoardManager::getRelayCount();

    for (uint8_t i = 0; i < count; i++)
    {
        bool state = (savedBitmask & (1 << i)) != 0;
        relayState[i] = state;
        digitalWrite(BoardManager::getRelayPin(i), state ? HIGH : LOW);
    }
    Serial.printf("[RELAY] Restored states from NVS (mask: 0x%02X)\n", savedBitmask);
}

bool begin()
{
    relayMutex = xSemaphoreCreateMutex();

    uint8_t count = BoardManager::getRelayCount();
    for (uint8_t i = 0; i < count; i++)
    {
        pinMode(BoardManager::getRelayPin(i), OUTPUT);
    }

    // Restore last state before power-cut
    restoreFromNVS();

    return true;
}

static void scheduleNvsCommit()
{
    nvsPending = true;
    nvsCommitTime = millis() + 500; // 500ms debounce to protect flash wear
}

void update()
{
    if (nvsPending && millis() >= nvsCommitTime)
    {
        nvsPending = false;
        uint8_t currentMask = getStateBitmask();
        if (currentMask != savedBitmask)
        {
            PreferencesManager::saveRelayStates(currentMask);
            savedBitmask = currentMask;
            Serial.printf("[RELAY] Saved state bitmask to NVS: 0x%02X\n", currentMask);
        }
    }
}

void on(uint8_t channel)
{
    if (channel >= BoardManager::getRelayCount())
        return;

    lock();
    digitalWrite(BoardManager::getRelayPin(channel), HIGH);
    relayState[channel] = true;
    scheduleNvsCommit();
    unlock();
}

void off(uint8_t channel)
{
    if (channel >= BoardManager::getRelayCount())
        return;

    lock();
    digitalWrite(BoardManager::getRelayPin(channel), LOW);
    relayState[channel] = false;
    scheduleNvsCommit();
    unlock();
}

void toggle(uint8_t channel)
{
    if (getState(channel))
        off(channel);
    else
        on(channel);
}

bool getState(uint8_t channel)
{
    if (channel >= BoardManager::getRelayCount())
        return false;

    return relayState[channel];
}

void setState(uint8_t channel, bool state)
{
    if (channel >= BoardManager::getRelayCount())
        return;

    if (relayState[channel] == state)
        return;

    if (state)
        on(channel);
    else
        off(channel);
}

}