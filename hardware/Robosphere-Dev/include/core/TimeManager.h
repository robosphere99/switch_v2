#pragma once

#include <Arduino.h>

namespace TimeManager {
bool begin();

void update();

bool isSynced();

String getTime();

String getDate();

String getDay();

String getDateTime();

unsigned long getUnixTime();
}