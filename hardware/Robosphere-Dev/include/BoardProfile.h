#pragma once

#include <Arduino.h>

enum BoardType
{
    BOARD_UNKNOWN = 0,
    BOARD_1R,
    BOARD_2R,
    BOARD_4R,
    BOARD_6R,
    BOARD_8R
};

struct BoardProfile
{
    BoardType id;

    char name[20];

    uint8_t relayCount;

    uint8_t relayPins[8];

    uint8_t switchPins[8];

    bool hasOLED;

    bool hasBuzzer;

    bool hasIR;

    bool hasRTC;

    bool hasTemperature;
};