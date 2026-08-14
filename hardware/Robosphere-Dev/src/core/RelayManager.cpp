#include "core/RelayManager.h"
#include "core/BoardManager.h"

static bool relayState[8];

namespace RelayManager
{

bool begin()
{
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

    digitalWrite(BoardManager::getRelayPin(channel), HIGH);

    relayState[channel] = true;
}

void off(uint8_t channel)
{
    if(channel >= BoardManager::getRelayCount())
        return;

    digitalWrite(BoardManager::getRelayPin(channel), LOW);

    relayState[channel] = false;
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