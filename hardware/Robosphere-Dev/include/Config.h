#pragma once
#include <Arduino.h>
//==================================================
// Firmware Information
//==================================================

constexpr char FIRMWARE_NAME[] = "SwitchNest IoT";
constexpr char FIRMWARE_VERSION[] = "1.1.0";

// Per-model build: platformio envs ise override karte hain (-DMODEL_CODE="8CH"
// etc.)
#ifndef MODEL_CODE
#define MODEL_CODE "4CH"
#endif

// Dimer models: steps = 3 (off->50->100) ya 4 (off->33->66->100); non-dimmer =
// 0
#ifndef MODEL_DIMMER_STEPS
#define MODEL_DIMMER_STEPS 0
#endif
constexpr char HARDWARE_VERSION[] = "1.0";

//==================================================
// Access Point Configuration
//==================================================

constexpr char DEFAULT_AP_SSID[] = "SwitchNest-IoT";
constexpr char DEFAULT_AP_PASSWORD[] = "12345678";

// Default webserver admin credentials (NVS empty hone pe yeh use hote hain)
constexpr char DEFAULT_ADMIN_USER[] = "admin";
constexpr char DEFAULT_ADMIN_PASSWORD[] = "admin";

//==================================================
// HTTP Server
//==================================================

constexpr uint16_t HTTP_PORT = 80;

//==================================================
// Device Configuration
//==================================================

constexpr uint8_t MAX_DEVICES = 20;
constexpr uint8_t MAX_RELAYS = 8;
constexpr uint8_t MAX_SWITCHES = 8;

//==================================================
// Preferences
//==================================================

constexpr char PREF_NAMESPACE[] = "robosphere";

constexpr char PREF_CONFIGURED[] = "config";
constexpr char PREF_WIFI_SSID[] = "wifi_ssid";
constexpr char PREF_WIFI_PASSWORD[] = "wifi_pass";

constexpr char PREF_ADMIN_USER[] = "admin_user";
constexpr char PREF_ADMIN_PASSWORD[] = "admin_pass";

constexpr char PREF_SERVER_URL[] = "server_url";
constexpr char PREF_API_KEY[] = "api_key";

// Server ne 401 diya (key invalid/expired/revoked) — provisioning mode flag.
// Persist hota hai taaki reboot ke baad bhi user ko pata rahe ki naya key dalna
// hai.
constexpr char PREF_KEY_INVALID[] = "key_invalid";

constexpr char PREF_OTA_URL[] = "ota_url";

constexpr char PREF_AP_NAME[] = "ap_name";
constexpr char PREF_AP_PASSWORD[] = "ap_pass";

// Dual-mode: WiFi connect hone ke baad bhi AP ON rahe (192.168.4.1 se
// hamesha reach) — default ON, setapkeep <on|off> se band kar sakte ho
constexpr char PREF_AP_KEEP[] = "ap_keep";

constexpr char PREF_RECOVERY_MODE[] = "recovery";

constexpr char PREF_SWITCH_MODE[] = "switch_mode";
constexpr char PREF_SERIAL_CODE[] = "serial_code";
constexpr char PREF_MODEL_CODE[] = "model_code";

// Switch behaviour modes
constexpr int SWITCH_MODE_MOMENTARY = 0; // Push button — dabane pe toggle
constexpr int SWITCH_MODE_TOGGLE = 1;    // Wall switch — har flip pe toggle

//==================================================
// Timeouts
//==================================================

constexpr uint32_t WIFI_TIMEOUT_MS = 20000;
constexpr uint32_t API_TIMEOUT_MS = 5000;
constexpr uint32_t RECONNECT_DELAY_MS = 5000;

//==================================================
// GPIO
//==================================================

constexpr int STATUS_LED_PIN = 2;
constexpr int RECOVERY_BUTTON_PIN = 0;

//==================================================
// Recovery
//==================================================

constexpr uint32_t RECOVERY_MODE_TIME_MS = 5000;
constexpr uint32_t FACTORY_RESET_TIME_MS = 10000;

//==================================================
// Debug
//==================================================

constexpr bool ENABLE_DEBUG = true;

#define PREF_STATUS_LED_DEVICE_ID "ledMap"

#define OTA_CHECK_URL                                                          \
  "" // legacy boot check — OTA ab server-push heartbeat se aata hai

#define OTA_TIMEOUT 15000

// #define FIRMWARE_VERSION   "0.15.0"