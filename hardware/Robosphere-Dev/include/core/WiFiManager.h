#pragma once

#include <Arduino.h>

namespace WiFiManager
{
    bool begin();

    void update();

    bool connect();

    void disconnect();

    bool isConnected();

    void startAccessPoint();

    void stopAccessPoint();

    String getIP();

    String getSSID();

    // Setup/recovery AP (deliberate) vs WiFi-fail fallback AP —
    // fallback AP mein device khud reconnect karta hai, setup AP mein nahi.
    bool isSetupAccessPoint();

    // Dual-mode: WiFi (STA) connect hone ke baad bhi AP ON rakho —
    // device 192.168.4.1 pe bhi reachable (server URL/API set karne ke liye).
    void ensureDualAP();

    bool isDualMode();

    String getAPIP();

    String getAPSSID();

    // mDNS hostname — bina IP jaane http://robosphere-xxxxxx.local se khulega
    String getHostname();
}