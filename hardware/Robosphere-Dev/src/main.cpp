#include "Config.h"
#include "core/Logger.h"
#include "core/OTAManager.h"
#include "core/WebServerManager.h"
#include "core/WiFiManager.h"
#include "preferences/PreferencesManager.h"
#include <ArduinoOTA.h>


#include "core/ApiManager.h"
#include "core/BoardManager.h"
#include "core/DimmerManager.h"
#include "core/LedManager.h"
#include "core/RecoveryManager.h"
#include "core/RelayManager.h"
#include "core/SwitchManager.h"
#include "core/SyncManager.h"
#include "core/SystemManager.h"
#include "core/TimeManager.h"


// ==================================================
// Serial Config - Setup mode mein USB se directly configure
// Commands (serial monitor mein type karo):
//   setwifi <ssid> <password>
//   setadmin <username> <password>
//   setserver <url> <api_key>
//   setotaurl <url>     (OTA check URL, empty = default wapas)
//   setapname <name>    (AP SSID — har unit ka alag naam, sell ke liye)
//   setappass <pass>    (AP password — setup AP ka default)
//   setapkeep <on|off>  (dual-mode: WiFi ke saath AP bhi ON rakho ya nahi)
//   setswitch <momentary|toggle>
//   export    (poora config JSON dump — provisioning verify ke liye)
//   reboot    (AP name apply karne ke liye restart — config save nahi)
//   finish     (config save karke restart)
//   help
// ==================================================
static String serialCmdLine = "";

void processSerialCommand(const String &line) {
  int sp = line.indexOf(' ');
  String cmd = sp > 0 ? line.substring(0, sp) : line;
  String arg = sp > 0 ? line.substring(sp + 1) : "";

  if (cmd == "help") {
    Serial.println("--- Serial Config Commands ---");
    Serial.println("setwifi <ssid> <password>");
    Serial.println("setadmin <username> <password>");
    Serial.println("setserver <url> <api_key>");
    Serial.println("setotaurl <url> (empty = default)");
    Serial.println("setapname <name>");
    Serial.println("setappass <pass>");
    Serial.println("setserial <code>   (factory serial — box sticker)");
    Serial.println("setmodel <code>    (2CH/4CH/6CH/8CH/DIM-4S...)");
    Serial.println("testrelay          (relay self-test — har channel cycle)");
    Serial.println("setapkeep <on|off> (dual-mode AP)");
    Serial.println("setswitch <momentary|toggle>");
    Serial.println("export");
    Serial.println("reboot");
    Serial.println("factoryreset");
    Serial.println("finish");
  } else if (cmd == "setwifi") {
    int sp2 = arg.indexOf(' ');
    if (sp2 <= 0) {
      Serial.println("Usage: setwifi <ssid> <password>");
      return;
    }
    PreferencesManager::saveWiFi(arg.substring(0, sp2), arg.substring(sp2 + 1));
    Serial.println("[OK] WiFi saved");
  } else if (cmd == "setadmin") {
    int sp2 = arg.indexOf(' ');
    if (sp2 <= 0) {
      Serial.println("Usage: setadmin <username> <password>");
      return;
    }
    PreferencesManager::saveAdmin(arg.substring(0, sp2),
                                  arg.substring(sp2 + 1));
    Serial.println("[OK] Admin saved");
  } else if (cmd == "setserver") {
    int sp2 = arg.indexOf(' ');
    if (sp2 <= 0) {
      Serial.println("Usage: setserver <url> <api_key>");
      return;
    }
    PreferencesManager::saveServer(arg.substring(0, sp2),
                                   arg.substring(sp2 + 1));
    Serial.println("[OK] Server saved");
  } else if (cmd == "setotaurl") {
    PreferencesManager::saveOTAURL(arg);

    if (arg.isEmpty())
      Serial.println("[OK] OTA URL cleared (default wapas)");
    else
      Serial.println("[OK] OTA URL saved");
  } else if (cmd == "setapname") {
    if (arg.isEmpty()) {
      Serial.println("Usage: setapname <name>");
      return;
    }

    PreferencesManager::saveAPName(arg);
    Serial.println("[OK] AP name saved (reboot pe apply hoga)");
  } else if (cmd == "setappass") {
    if (arg.isEmpty()) {
      Serial.println("Usage: setappass <pass>");
      return;
    }

    PreferencesManager::saveAPPassword(arg);
    Serial.println("[OK] AP password saved (reboot pe apply hoga)");
  } else if (cmd == "export") {
    Serial.println("===== CONFIG EXPORT =====");
    Serial.println("MAC : " + SystemManager::getMacAddress());
    Serial.println(PreferencesManager::exportConfiguration());
    Serial.println("===== CONFIG EXPORT END =====");
  } else if (cmd == "reboot") {
    Serial.println("[OK] Rebooting...");
    delay(500);
    ESP.restart();
  } else if (cmd == "factoryreset") {
    PreferencesManager::factoryReset();
    Serial.println("[OK] Factory reset done. Rebooting...");
    delay(500);
    ESP.restart();
  } else if (cmd == "setapkeep") {
    if (arg == "on") {
      PreferencesManager::saveAPKeepEnabled(true);
      Serial.println(
          "[OK] AP always-ON (dual mode) — 192.168.4.1 se hamesha reach");
    } else if (arg == "off") {
      PreferencesManager::saveAPKeepEnabled(false);
      Serial.println("[OK] AP WiFi connect hone ke baad band (sirf LAN pe)");
    } else {
      Serial.println("Usage: setapkeep <on|off>");
    }
  } else if (cmd == "setswitch") {
    if (arg == "toggle") {
      PreferencesManager::saveSwitchMode(SWITCH_MODE_TOGGLE);
      Serial.println("[OK] Switch mode: Wall Switch (toggle)");
    } else if (arg == "momentary") {
      PreferencesManager::saveSwitchMode(SWITCH_MODE_MOMENTARY);
      Serial.println("[OK] Switch mode: Push Button (momentary)");
    } else {
      Serial.println("Usage: setswitch <momentary|toggle>");
    }
  } else if (cmd == "setserial") {
    if (arg.isEmpty()) {
      Serial.println("Usage: setserial <code>");
      return;
    }
    arg.toUpperCase();
    PreferencesManager::saveSerialCode(arg);
    Serial.println("[OK] Serial code saved: " + arg);
  } else if (cmd == "setmodel") {
    if (arg.isEmpty()) {
      Serial.println("Usage: setmodel <code>");
      return;
    }
    arg.toUpperCase();
    PreferencesManager::saveModelCode(arg);
    Serial.println("[OK] Model code saved: " + arg);
  } else if (cmd == "testrelay") {
    uint8_t count = BoardManager::getRelayCount();
    if (count == 0) {
      Serial.println("[FAIL] No relays configured");
      return;
    }
    Serial.println("=== RELAY SELF-TEST START ===");
    bool allOk = true;
    for (uint8_t ch = 0; ch < count; ch++) {
      RelayManager::off(ch);
      delay(100);
      RelayManager::on(ch);
      delay(800);
      bool state = RelayManager::getState(ch);
      RelayManager::off(ch);
      delay(300);
      if (state) {
        Serial.println("RELAY " + String(ch + 1) + " OK");
      } else {
        Serial.println("RELAY " + String(ch + 1) + " FAIL");
        allOk = false;
      }
    }
    if (allOk)
      Serial.println("[OK] All " + String(count) + " relays passed");
    else
      Serial.println("[FAIL] Some relays failed");
    Serial.println("=== RELAY SELF-TEST END ===");
  } else if (cmd == "finish") {
    if (PreferencesManager::getWiFiSSID().isEmpty()) {
      Serial.println("[ERR] Pehle setwifi karo");
    } else {
      PreferencesManager::setConfigured(true);
      Serial.println("[OK] Config complete. Restarting...");
      delay(500);
      ESP.restart();
    }
  } else {
    Serial.println("Unknown command. Type 'help'");
  }
}

void handleSerialConfig() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (serialCmdLine.length() > 0) {
        serialCmdLine.trim();
        Serial.print("CMD> ");
        Serial.println(serialCmdLine);
        processSerialCommand(serialCmdLine);
        serialCmdLine = "";
      }
    } else {
      serialCmdLine += c;
    }
  }
}

void setup() {
  Logger::begin();
  OTAManager::begin();
  LedManager::begin();
  LedManager::setMode(LedManager::HEARTBEAT);
  PreferencesManager::begin();

  BoardManager::begin();

  RelayManager::begin();

  DimmerManager::begin();

  SwitchManager::begin();

  RecoveryManager::begin();

  SyncManager::begin();

  bool recoveryMode = PreferencesManager::getBool(PREF_RECOVERY_MODE);

  if (recoveryMode) {
    PreferencesManager::putBool(PREF_RECOVERY_MODE, false);

    WiFiManager::startAccessPoint();
    LedManager::setMode(LedManager::SETUP);
    Logger::success("Recovery AP Started");
  } else {
    LedManager::setMode(LedManager::WIFI_CONNECTING);
    WiFiManager::begin();

    // OTA check aur time sync sirf tab jab WiFi station mode mein connected ho.
    // Factory-reset / setup state mein sirf web server chalta hai taaki
    // OTA check boot ko block na kare aur initial connection kharab na ho.
    if (WiFiManager::isConnected()) {
      TimeManager::begin();
      Serial.println("Checking OTA...");

      if (OTAManager::checkUpdate()) {
        Serial.println("Current : " + OTAManager::getCurrentVersion());

        Serial.println("Latest : " + OTAManager::getLatestVersion());

        Serial.println("Status : " + OTAManager::getStatus());

        Serial.println("Notes : " + OTAManager::getReleaseNotes());
      } else {
        Serial.println("OTA Check Failed");
      }

      // ArduinoOTA — WiFi pe firmware upload (PlatformIO: pio run -t upload
      // --upload-port <IP>) Password = admin password (web login wala) — isliye
      // OTA bhi utna hi protected hai
      ArduinoOTA.setHostname("SwitchNest-IoT");

      String otaPass = PreferencesManager::getAdminPassword();

      if (!otaPass.isEmpty()) {
        ArduinoOTA.setPassword(otaPass.c_str());
      }

      ArduinoOTA.onStart([]() { Serial.println("ArduinoOTA: Starting..."); });

      ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
        Serial.printf("ArduinoOTA Progress: %u%%\r\n",
                      progress / (total / 100));
      });

      ArduinoOTA.onEnd(
          []() { Serial.println("\nArduinoOTA: Done. Restarting..."); });

      ArduinoOTA.onError([](ota_error_t err) {
        Serial.printf("ArduinoOTA Error: %u\n", err);
      });

      ArduinoOTA.begin();

      Logger::success("ArduinoOTA Ready");
    } else {
      Logger::warning("Setup/AP Mode - OTA Check Skipped");
    }
  }

  WebServerManager::begin();
}

void loop() {
  handleSerialConfig();

  ArduinoOTA.handle();

  LedManager::update();

  OTAManager::update();

  WiFiManager::update();

  TimeManager::update();

  WebServerManager::update();

  SwitchManager::update();

  ApiManager::update();

  RecoveryManager::update();

  SyncManager::update();
}
