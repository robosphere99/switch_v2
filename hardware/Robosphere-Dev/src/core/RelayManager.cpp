#include "core/RelayManager.h"
#include "core/BoardManager.h"

static bool relayState[8];

// Command-poll task (core 0) aur main loop (core 1) dono relays ko chhu sakte
// hain — ek simple mutex se torn writes / simultaneous toggles se bachte hain.
// setState/toggle internally on()/off() call karte hain (jo khud lock karte
// hain) — isliye yahan nested lock nahi hai, deadlock impossible hai.
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

bool begin()
{
    relayMutex = xSemaphoreCreateMutex();

    for(uint8_t i = 0; i < BoardManager::getRelayCount(); i++)
    {
        pinMode(BoardManager::getRelayPin(i), OUTPUT);

        digitalWrite(BoardManager::getRelayPin(i), LOW);

        relayState[i] = false;
    }

    return true;
}

void on(uint8_t channel)
{
    if(channel >= BoardManager::getRelayCount())
        return;

    lock();
    digitalWrite(BoardManager::getRelayPin(channel), HIGH);
    relayState[channel] = true;
    unlock();
}

void off(uint8_t channel)
{
    if(channel >= BoardManager::getRelayCount())
        return;

    lock();
    digitalWrite(BoardManager::getRelayPin(channel), LOW);
    relayState[channel] = false;
    unlock();
}

void toggle(uint8_t channel)
{
    if(getState(channel))
        off(channel);
    else
        on(channel);
}

bool getState(uint8_t channel)
{
    if(channel >= BoardManager::getRelayCount())
        return false;

    return relayState[channel];
}
void setState(uint8_t channel, bool state)
{
    if(channel >= BoardManager::getRelayCount())
        return;

    if(relayState[channel] == state)
        return;

    if(state)
        on(channel);
    else
        off(channel);
}

}