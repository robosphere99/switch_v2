#pragma once

#include <Arduino.h>

namespace MqttManager {

// Initializes MQTT client and sets up the server based on PreferencesManager
void begin();

// Call in the main loop to handle MQTT keep-alive, message processing, and
// reconnects
void loop();

bool publishState(bool forceTelemetry = false);

// Publish logs to sn/{mac}/log
void publishLog(const String& msg);

// Check if MQTT is currently connected
bool isConnected();

} // namespace MqttManager
