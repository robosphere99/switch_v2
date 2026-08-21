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
          Serial.println();
          Serial.println("========== SWITCH ==========");

          Serial.print("Relay : ");
          Serial.println(i);

          if (DimmerManager::isDimmer()) {
            // Dimmer model: switch step cycle karta hai (off->33->66->100 etc.)
            uint8_t step = DimmerManager::cycle(i);
            Serial.print("Dimmer Step : ");
            Serial.println(step);
            Serial.print("Dimmer Percent : ");
            Serial.println(DimmerManager::getStepPercent(i));
          } else {
            RelayManager::toggle(i);
          }

          bool state = RelayManager::getState(i);

          Serial.print("Relay State : ");
          Serial.println(state ? "ON" : "OFF");

          int channel = i + 1; // 1-indexed channel

          Serial.print("Channel : ");
          Serial.println(channel);

          // Debounced batch push — short interval ke updates ek saath jaate
          // hain
          bool ok = ApiManager::queueDeviceUpdate(channel, state);

          Serial.print("API : ");
          Serial.println(ok ? "QUEUED" : "FAILED");

          Serial.println("============================");
        }

        lastState[i] = currentState;
      }
    }
  }
}

} // namespace SwitchManager