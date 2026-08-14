#pragma once

#include <Arduino.h>

namespace ResponseManager
{
    String success(const String &message);

    String error(const String &message);

    String success(const String &message,
                   const String &data);
}