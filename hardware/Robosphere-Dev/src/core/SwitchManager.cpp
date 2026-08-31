#include "core/SwitchManager.h"

#include <Arduino.h>

#include "Config.h"
#include "core/ApiManager.h"
#include "core/BoardManager.h"
#include "core/DimmerManager.h"
#include "core/RelayManager.h"
#include "preferences/PreferencesManager.h"

static bool lastState[8];
static unsigned long debounceStart[8];
static bool debouncing[8];

namespace SwitchManager {

bool begin() {
  for (uint8_t i = 0; i < BoardManager::getRelayCount(); i++) {
    pinMode(BoardManager::getSwitchPin(i), INPUT_PULLUP);

    lastState[i] = digitalRead(BoardManager::getSwitchPin(i));

    debouncing[i] = false;
  }

  return true;
}

void update() {
  int switchMode = PreferencesManager::getSwitchMode();

  for (uint8_t i = 0; i < BoardManager::getRelayCount(); i++) {
    bool currentState = digitalRead(BoardManager::getSwitchPin(i));

    if (!debouncing[i] && currentState != lastState[i]) {
      // Non-blocking debounce — delay() loop ko freeze nahi karta,
      // switch hamesha instant respond karta hai
      debouncing[i] = true;

      debounceStart[i] = millis();
    }

    if (debouncing[i] && (long)(millis() - debounceStart[i]) >= 30) {
      debouncing[i] = false;

      currentState = digitalRead(BoardManager::getSwitchPin(i));

      if (currentState != lastState[i]) {
        // Hardcoding standard toggle (wall switch) behavior.
        // Har position change pe toggle hoga (dono edges kaam karenge),
        // overriding software preferences.
        bool trigger = true;

        if (trigger) {
          if (DimmerManager::isDimmer()) {
            uint8_t step = DimmerManager::cycle(i);
            Serial.printf("[SWITCH] Dimmer %d -> Step %d (%d%%)\n", i, step,
                          DimmerManager::getStepPercent(i));
          } else {
            RelayManager::toggle(i);
          }

          bool state = RelayManager::getState(i);
          int channel = i + 1; // 1-indexed channel

          bool ok = ApiManager::queueDeviceUpdate(channel, state);
          Serial.printf("[SWITCH] Channel %d -> %s (API: %s)\n", channel,
                        state ? "ON" : "OFF", ok ? "QUEUED" : "FAILED");
        }

        lastState[i] = currentState;
      }
    }
  }
}

} // namespace SwitchManager