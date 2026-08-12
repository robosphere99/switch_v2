#include "core/BoardManager.h"
#include "core/BoardProfiles.h"
#include "preferences/PreferencesManager.h"
#include "Config.h"

static const BoardProfile* currentBoard = nullptr;

namespace BoardManager
{

bool begin()
{
#if defined(MODEL_DIM3) || defined(MODEL_DIM4)
    currentBoard = &board1R;
#elif defined(MODEL_2CH)
    currentBoard = &board2R;
#elif defined(MODEL_8CH)
    currentBoard = &board8R;
#else
    currentBoard = &board4R;
#endif
    return true;
}

void setBoard(BoardType type)
{
    switch(type)
    {
        case BOARD_2R:
            currentBoard = &board2R;
            break;

        case BOARD_4R:
            currentBoard = &board4R;
            break;

        case BOARD_6R:
            currentBoard = &board6R;
            break;

        case BOARD_8R:
            currentBoard = &board8R;
            break;

        default:
            currentBoard = &board4R;
            break;
    }
}

const BoardProfile* getBoard()
{
    return currentBoard;
}

uint8_t getRelayCount()
{
    if(currentBoard == nullptr)
        return 0;

    return currentBoard->relayCount;
}

uint8_t getRelayPin(uint8_t channel)
{
    if(channel >= currentBoard->relayCount)
        return 255;

    return currentBoard->relayPins[channel];
}

uint8_t getSwitchPin(uint8_t channel)
{
    if(channel >= currentBoard->relayCount)
        return 255;

    return currentBoard->switchPins[channel];
}

String getModelCode()
{
    String pref = PreferencesManager::getModelCode();
    if (!pref.isEmpty())
        return pref;
    return String(MODEL_CODE);
}

bool isDimmer()
{
#if defined(MODEL_DIM3) || defined(MODEL_DIM4)
    return true;
#else
    return false;
#endif
}

uint8_t getDimmerSteps()
{
    return MODEL_DIMMER_STEPS;
}

}