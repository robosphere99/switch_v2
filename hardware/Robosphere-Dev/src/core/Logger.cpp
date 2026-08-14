#include <Arduino.h>
#include "core/Logger.h"

namespace Logger
{

void begin(long baudRate)
{
    Serial.begin(baudRate);
    delay(500);

    Serial.println();
    Serial.println("======================================");
    Serial.println("      Robosphere IoT Firmware");
    Serial.println("======================================");
}

void info(const char *message)
{
    Serial.print("[INFO] ");
    Serial.println(message);
}

void success(const char *message)
{
    Serial.print("[SUCCESS] ");
    Serial.println(message);
}

void warning(const char *message)
{
    Serial.print("[WARNING] ");
    Serial.println(message);
}

void error(const char *message)
{
    Serial.print("[ERROR] ");
    Serial.println(message);
}

void api(const char *message)
{
    Serial.print("[API] ");
    Serial.println(message);
}

void wifi(const char *message)
{
    Serial.print("[WiFi] ");
    Serial.println(message);
}

void system(const char *message)
{
    Serial.print("[SYSTEM] ");
    Serial.println(message);
}

}