#pragma once

#include <Arduino.h>

namespace RelayManager
{
    bool begin();

    void update();

    void on(uint8_t channel);

    void off(uint8_t channel);

    void toggle(uint8_t channel);

    bool getState(uint8_t channel);

    void setState(uint8_t channel, bool state);

    uint8_t getStateBitmask();

    void restoreFromNVS();
}