#include "core/RecoveryManager.h"
#include "preferences/PreferencesManager.h"
#include <Arduino.h>
#include "core/LedManager.h"
#include "Config.h"

static unsigned long pressStartTime = 0;

static bool buttonPressed = false;

static bool recoveryReady = false;

static bool factoryReady = false;

// GPIO0 (BOOT button) footgun guards — isliye zaroori:
// ESP32 dev kit pe RECOVERY_BUTTON_PIN = GPIO 0 (BOOT button) hai. Jab bhi
// serial monitor / uploader DTR line ko assert karta hai, GPIO0 LOW ho jaata
// hai ("button pressed") — agar woh 10s tak LOW rahe toh port close hote hi
// device FACTORY RESET ho jaati thi (ghalta se config wipe!).
static unsigned long bootTime = 0;
static bool sawRelease = false;
namespace RecoveryManager {

bool begin() {
  pinMode(RECOVERY_BUTTON_PIN, INPUT_PULLUP);
  bootTime = millis();
  sawRelease = false;
  return true;
}

void update() {
  bool pressed = (digitalRead(RECOVERY_BUTTON_PIN) == LOW);
  unsigned long now = millis();

  // Guard 1: boot ke baad pehle 3s button ignore — reset/flash sequence ke
  // dauran GPIO0 transient LOW hota hai, galat trigger na ho.
  if (now - bootTime < 3000)
    return;

  // Guard 2: press tabhi count karo jab boot ke baad button RELEASED (HIGH)
  // dekha gaya ho. DTR (serial monitor) pin ko poore session LOW rakhta hai —
  // isse recovery/factory reset KABHI arm nahi hoga. Asli button dabane pe
  // pehle release hota hai, phir press.
  if (!pressed && !sawRelease)
    sawRelease = true;
  if (!sawRelease)
    return;

  if (pressed && !buttonPressed) {
    buttonPressed = true;

    pressStartTime = millis();

    recoveryReady = false;

    factoryReady = false;

    Serial.println();
    Serial.println("Recovery Button Pressed");
  }

  if (!pressed && buttonPressed) {
    buttonPressed = false;

    Serial.println("Recovery Button Released");

    if (factoryReady) {
      Serial.println("Factory Reset");
      LedManager::setMode(LedManager::ON);
      PreferencesManager::factoryReset();
      delay(500);
      ESP.restart();
    } else if (recoveryReady) {
      Serial.println("Recovery Mode");

      PreferencesManager::putBool(PREF_RECOVERY_MODE, true);

      delay(500);

      ESP.restart();
      // WiFiManager::startAccessPoint();
    }
  }
  if (!buttonPressed)
    return;

  unsigned long holdTime = millis() - pressStartTime;

  if (!recoveryReady && holdTime >= RECOVERY_MODE_TIME_MS) {
    recoveryReady = true;

    Serial.println("Recovery Ready");

    // LedManager::blink(500);
  }

  if (!factoryReady && holdTime >= FACTORY_RESET_TIME_MS) {
    factoryReady = true;

    Serial.println("Factory Reset Ready");

    // LedManager::blink(100);
  }
}
}