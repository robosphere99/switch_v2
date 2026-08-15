#pragma once

#include <Arduino.h>

String SystemPage(
    const String &board,
    const String &firmware,
    const String &ip,
    uint32_t uptime,
    uint32_t freeHeap,
    const String &date,
    const String &time,
    const String &day,
    bool synced,

    const String &currentVersion,
    const String &latestVersion,
    const String &otaStatus,
    const String &releaseNotes,
    int otaProgress,
    const String &otaUrl,
    bool ledEnabled
);