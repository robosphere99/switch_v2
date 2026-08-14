#pragma once

#include <Preferences.h>

namespace PreferencesManager
{
    bool begin();

    bool isConfigured();

    void setConfigured(bool status);

    void saveWiFi(const String& ssid, const String& password);

    String getWiFiSSID();

    String getWiFiPassword();

    void saveAdmin(const String& username, const String& password);

    String getAdminUsername();

    String getAdminPassword();

    void saveServer(const String& url, const String& apiKey);

    String getServerURL();

    String getApiKey();

    void saveOTAURL(const String& url);

    String getOTAURL();

    void saveAPName(const String& name);

    String getAPName();

    void saveAPPassword(const String& password);

    String getAPPassword();

    // Dual-mode: WiFi connect hone ke baad bhi AP ON rahe (default true)
    void saveAPKeepEnabled(bool enabled);

    bool getAPKeepEnabled();

    void putInt(const char* key, int value);

    int getInt(const char* key, int defaultValue = -1);

    void factoryReset();

    bool putBool(const char* key, bool value);

    bool getBool(const char* key, bool defaultValue = false);

    String exportConfiguration();

    bool importConfiguration(const String &json);

    bool validateConfiguration(const String &json);

    void saveStatusLedMapping(int deviceId);

    int getStatusLedMapping();

    void saveSwitchMode(int mode);

    int getSwitchMode();

    void saveSerialCode(const String& code);

    String getSerialCode();

    void saveModelCode(const String& code);

    String getModelCode();
    
}