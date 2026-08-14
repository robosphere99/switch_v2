#pragma once

#include "BoardProfile.h"

namespace BoardManager
{
    bool begin();

    void setBoard(BoardType type);

    const BoardProfile* getBoard();

    uint8_t getRelayCount();

    uint8_t getRelayPin(uint8_t channel);

    uint8_t getSwitchPin(uint8_t channel);

    String getModelCode();

    bool isDimmer();

    uint8_t getDimmerSteps();
}