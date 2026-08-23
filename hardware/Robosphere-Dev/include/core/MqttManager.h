#pragma once

#include <Arduino.h>

namespace MqttManager {

// Initializes MQTT client and sets up the server based on PreferencesManager
void begin();

// Call in the main loop to handle MQTT keep-alive, message processing, and
// reconnects
void loop();

// Publishes the current relay states to sn/{mac}/state
bool publishState();

// Check if MQTT is currently connected
bool isConnected();

} // namespace MqttManager
