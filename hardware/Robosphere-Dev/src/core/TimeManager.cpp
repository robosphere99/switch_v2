static unsigned long lastSync = 0;

const unsigned long SYNC_INTERVAL = 12UL * 60UL * 60UL * 1000UL;
// 12 Hours
#include "core/TimeManager.h"

#include <WiFi.h>
#include <time.h>

static bool synced = false;

const char* ntpServer1 = "pool.ntp.org";
const char* ntpServer2 = "time.google.com";

const long gmtOffset = 19800;
const int daylightOffset = 0;

namespace TimeManager
{

bool begin()
{
    configTime(
        gmtOffset,
        daylightOffset,
        ntpServer1,
        ntpServer2
    );

    return true;
}

void update()
{
    if(WiFi.status() != WL_CONNECTED)
        return;

    if(millis() - lastSync < SYNC_INTERVAL && synced)
        return;

    // getLocalTime() bina timeout ke SNTP response ka wait karta hai —
    // WiFi down / NTP unreachable hone par seconds tak block kar sakta
    // hai. Timeout guard: 1s ke andar sync nahi hua toh skip (loop
    // responsive rehta hai, wall switch instant kaam karta hai).
    struct tm timeinfo;

    if(getLocalTime(&timeinfo, 1000))
    {
        synced = true;

        lastSync = millis();

        Serial.println("Time Synced");
    }
    else
    {
        // Fail hone par bar-bar try mat karo — 30s ke baad next attempt
        lastSync = millis() - SYNC_INTERVAL + 30000;
    }
}

bool isSynced()
{
    return synced;
}

String getTime()
{
    struct tm timeinfo;

    if(!getLocalTime(&timeinfo))
        return "--:--:--";

    char buffer[10];

    strftime(buffer,sizeof(buffer),"%H:%M:%S",&timeinfo);

    return String(buffer);
}

String getDate()
{
    struct tm timeinfo;

    if(!getLocalTime(&timeinfo))
        return "--/--/----";

    char buffer[20];

    strftime(buffer,sizeof(buffer),"%d-%m-%Y",&timeinfo);

    return String(buffer);
}

String getDay()
{
    struct tm timeinfo;

    if(!getLocalTime(&timeinfo))
        return "---";

    char buffer[20];

    strftime(buffer,sizeof(buffer),"%A",&timeinfo);

    return String(buffer);
}

String getDateTime()
{
    return getDate()+" "+getTime();
}

unsigned long getUnixTime()
{
    time_t now;

    time(&now);

    return now;
}

}