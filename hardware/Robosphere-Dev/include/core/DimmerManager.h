#pragma once

#include <Arduino.h>

// Step-based dimmer (3S: off->50->100 | 4S: off->33->66->100).
// Relay-based abhi: step > 0 = relay ON. Future: PWM/triac per step.
namespace DimmerManager
{
    void begin();

    uint8_t getSteps();

    bool isDimmer();

    // Current step index for a channel (0 = off, 1..steps)
    uint8_t getStep(uint8_t channel);

    // Cycle to next step; returns new step index
    uint8_t cycle(uint8_t channel);

    // Apply step to the relay + persist
    void applyStep(uint8_t channel, uint8_t step);

    // Step -> percentage string ("33" / "66" / "100")
    String getStepPercent(uint8_t channel);
}
