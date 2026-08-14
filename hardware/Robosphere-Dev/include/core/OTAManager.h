#pragma once

#include <Arduino.h>

namespace OTAManager
{
    bool begin();

    void update();

    bool checkUpdate();

    bool startUpdate();

    // Direct firmware URL se update (version.json check ke bina) —
    // dashboard se user jahan se chahe .bin URL deke update kar sake
    bool startUpdateFromURL(const String &url);

    bool isUpdateAvailable();

    bool isUpdating();

    int getProgress();

    String getCurrentVersion();

    String getLatestVersion();

    String getReleaseNotes();

    String getStatus();

    String getFirmwareURL();

    String getLastError();

    // OTAState getState();
}