#include "core/BoardManager.h"
#include "Config.h"
#include "core/BoardProfiles.h"
#include "preferences/PreferencesManager.h"

static const BoardProfile *currentBoard = nullptr;

namespace BoardManager {

bool begin() {
  String model = getModelCode();

  if (model.startsWith("DIM")) {
    currentBoard = &board1R;
  } else if (model == "2CH") {
    currentBoard = &board2R;
  } else if (model == "6CH") {
    currentBoard = &board6R;
  } else if (model == "8CH") {
    currentBoard = &board8R;
  } else {
    currentBoard = &board4R;
  }

  return true;
}

void setBoard(BoardType type) {
  switch (type) {
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

static bool _boardInit = false;

static String _relayNames[8] = {"", "", "", "", "", "", "", ""};

void setRelayName(uint8_t index, const String &name) {
  if (index < 8) {
    _relayNames[index] = name;
  }
}

String getRelayName(uint8_t index) {
  if (index < 8) {
    return _relayNames[index];
  }
  return "";
}

const BoardProfile *getBoard() { return currentBoard; }

uint8_t getRelayCount() {
  if (currentBoard == nullptr)
    return 0;

  return currentBoard->relayCount;
}

uint8_t getRelayPin(uint8_t channel) {
  if (channel >= currentBoard->relayCount)
    return 255;

  return currentBoard->relayPins[channel];
}

uint8_t getSwitchPin(uint8_t channel) {
  if (channel >= currentBoard->relayCount)
    return 255;

  return currentBoard->switchPins[channel];
}

String getModelCode() {
  String pref = PreferencesManager::getModelCode();
  if (!pref.isEmpty())
    return pref;
  return String(MODEL_CODE);
}

bool isDimmer() {
#if defined(MODEL_DIM3) || defined(MODEL_DIM4)
  return true;
#else
  return false;
#endif
}

uint8_t getDimmerSteps() { return MODEL_DIMMER_STEPS; }

} // namespace BoardManager