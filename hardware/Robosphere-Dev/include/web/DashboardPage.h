#pragma once

#include <Arduino.h>

String DashboardPage(
    const String &ip,
    const String &ssid,
    const String &version,
    int totalDevices,
    int mappedRelays,
    int totalRelays,
    const String &boardName,
    bool serverConnected,
    bool setupAccessPoint,
    bool dualMode,
    const String &apIp,
    const String &apSsid,
    const String &hostname
);