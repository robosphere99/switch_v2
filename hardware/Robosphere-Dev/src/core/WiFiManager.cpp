#include "core/WiFiManager.h"

#include <WiFi.h>
#include <ESPmDNS.h>
#include "core/LedManager.h"
#include "Config.h"
#include "core/Logger.h"
#include "preferences/PreferencesManager.h"
static bool accessPointMode = false;

// Dual-mode: WiFi (STA) connected hone ke baad bhi AP ON (192.168.4.1 se
// hamesha reach) — fresh setup ke baad IP dhoondhne ki zaroorat nahi.
static bool dualApActive = false;
static String mdnsHostname = "";

static String computeHostname()
{
    String mac = WiFi.macAddress();
    mac.replace(":", "");
    mac.toLowerCase();
    return "switchnest-" + mac.substring(mac.length() - 6);
}

static void startMDNS()
{
    if (!mdnsHostname.isEmpty())
        return;

    mdnsHostname = computeHostname();

    if (MDNS.begin(mdnsHostname.c_str()))
    {
        String msg = String("mDNS: http://") + mdnsHostname + ".local";
        Logger::success(msg.c_str());
    }
    else
        Logger::warning("mDNS begin failed");
}

// Setup AP (recovery/init — deliberate, auto-reconnect NAHI)
// vs fallback AP (WiFi fail hone par — auto-reconnect HOTA hai)
static bool setupAccessPoint = false;

// ==================================================
// Non-blocking reconnection
//
// Problem: WiFi drop hone par purana connect() main loop ko 20s tak
// block karta tha (delay(250) loop) — is dauran wall switch, web
// server, sab freeze ho jaate the ("hang jaisa feel").
//
// Fix: reconnect ab async hai — update() connection start karta hai
// aur turant return; loop continue chalta hai (switch kaam karta
// hai), WiFi background mein connect hota hai. Timeout pe AP mode.
// ==================================================
static bool connecting = false;
static unsigned long connectStartedAt = 0;

// AP mode auto-reconnect: fallback AP mein device har kuch minute
// WiFi scan karta hai — saved network milte hi AP chhod ke station
// pe wapas. Setup/recovery AP ko kabhi disturb nahi karta.
static const unsigned long AP_RETRY_INTERVAL_MS = 300000; // 5 min
static unsigned long apRetryDue = 0;

namespace WiFiManager {

// Effective AP credentials: saved (user/webserver se edit) → serial-derived
// (SwitchNest-<serial> / serial key) → factory default. Serial ho to board ka
// hotspot hamesha unique rehta hai (factory reset ke baad bhi).
static void effectiveAPCreds(String &name, String &pass)
{
    if (name.isEmpty()) {
        String serial = PreferencesManager::getSerialCode();
        if (!serial.isEmpty())
            name = "SwitchNest-" + serial;
        else
            name = DEFAULT_AP_SSID;
    }
    if (pass.isEmpty()) {
        String serial = PreferencesManager::getSerialCode();
        if (!serial.isEmpty())
            pass = serial;
        else
            pass = DEFAULT_AP_PASSWORD;
    }
}

// Dual-mode softAP — station connect/reconnect ke dauran bhi AP ON rakhta
// hai (192.168.4.1). ensureDualAP() jaisa hi, par WiFi connected hona
// zaroori nahi — isliye offline/local control hamesha reachable rehta hai.
static void startDualSoftAP()
{
    String apName = PreferencesManager::getAPName();
    String apPass = PreferencesManager::getAPPassword();

    effectiveAPCreds(apName, apPass);

    WiFi.mode(WIFI_AP_STA);
    WiFi.softAP(apName.c_str(), apPass.c_str());

    dualApActive = true;

    Serial.print("AP SSID : ");
    Serial.println(apName);

    Serial.print("AP IP : ");
    Serial.println(WiFi.softAPIP());
}

// WiFi.begin() start karo aur turant return — blocking wait nahi.
static void beginConnect()
{
    String ssid = PreferencesManager::getWiFiSSID();
    String password = PreferencesManager::getWiFiPassword();

    if (ssid.isEmpty())
    {
        Logger::warning("WiFi SSID Not Found");
        return;
    }

    Logger::wifi("Connecting...");

    WiFi.disconnect(true);
    delay(200);

    // AP keep ON: reconnect ke dauran bhi AP ON (WIFI_AP_STA) rakho —
    // WiFi gir jaye toh bhi local panel 192.168.4.1 pe hamesha reachable,
    // switch/panel se ON-OFF chalta rehta hai (cloud sync background me).
    if (PreferencesManager::getAPKeepEnabled())
    {
        if (!dualApActive)
            startDualSoftAP();
    }
    else
    {
        WiFi.mode(WIFI_STA);
    }

    WiFi.begin(ssid.c_str(), password.c_str());

    // Modem sleep off — default power-save mein idle gap ke baad pehli
    // request ~1s late aati hai (modem wake latency), isliye dashboard
    // polls laggy feel hote the. Mains-powered device hai, power kharch
    // koi issue nahi.
    WiFi.setSleep(false);

    connecting = true;
    connectStartedAt = millis();
}

// Boot/init ke liye blocking connect (setup() mein ek baar — OK)
bool connect()
{
    accessPointMode = false;

    if (WiFi.status() == WL_CONNECTED)
        return true;

    LedManager::setMode(LedManager::SETUP);
    beginConnect();

    unsigned long startTime = millis();

    while (WiFi.status() != WL_CONNECTED)
    {
        if (millis() - startTime > WIFI_TIMEOUT_MS)
        {
            Logger::error("WiFi Connection Timeout");

            WiFi.disconnect(true);
            connecting = false;

            return false;
        }

        delay(250);
        Serial.print(".");
    }

    Serial.println();
    connecting = false;
    LedManager::setMode(LedManager::HEARTBEAT);
    Logger::success("WiFi Connected");

    Serial.print("IP : ");
    Serial.println(WiFi.localIP());

    startMDNS();
    ensureDualAP();

    return true;
}

void startAccessPoint() {
  accessPointMode = true;
  setupAccessPoint = false;
  apRetryDue = millis() + AP_RETRY_INTERVAL_MS;
  Logger::wifi("Starting Access Point...");
  LedManager::setMode(LedManager::SETUP);

  // Station connect/disconnect events - phone ke join attempt ko diagnose karne ke liye
  static bool eventsRegistered = false;
  if (!eventsRegistered) {
    eventsRegistered = true;
    WiFi.onEvent([](WiFiEvent_t event, WiFiEventInfo_t info) {
      Serial.println("[WiFi] Station Joined - phone ka association device tak pahuncha");
    }, WiFiEvent_t::ARDUINO_EVENT_WIFI_AP_STACONNECTED);
    WiFi.onEvent([](WiFiEvent_t event, WiFiEventInfo_t info) {
      Serial.println("[WiFi] Station Disconnected");
    }, WiFiEvent_t::ARDUINO_EVENT_WIFI_AP_STADISCONNECTED);
  }

  // Provisioning tool (tools/provision.py) se set kiya hua AP name/password
  // prefer karo — serial-derived / factory default sirf tab jab kuch save nahi.
  String apName = PreferencesManager::getAPName();
  String apPass = PreferencesManager::getAPPassword();

  effectiveAPCreds(apName, apPass);

  WiFi.mode(WIFI_AP);
  WiFi.softAP(apName.c_str(), apPass.c_str());

  Logger::success("Access Point Started");

  Serial.print("AP SSID : ");
  Serial.println(apName);

  Serial.print("AP IP : ");
  Serial.println(WiFi.softAPIP());
}

void stopAccessPoint() {
  WiFi.softAPdisconnect(true);
}

bool begin()
{
    if (!PreferencesManager::isConfigured())
    {
        // Deliberate setup AP — device yahan tab tak rahega jab tak
        // user setup complete karke reboot nahi karta. Auto-reconnect NO.
        setupAccessPoint = true;
        startAccessPoint();
        return false;
    }

    if(connect())
    {
        return true;
    }

    Logger::warning("Starting Setup AP");

    // WiFi configured par connect fail — fallback AP. Auto-reconnect YES.
    startAccessPoint();

    return false;
}

void update()
{
    static unsigned long previousMillis = 0;

    // ---- AP mode: background auto-reconnect attempt ----
    // Setup/recovery AP (deliberate) kabhi disturb nahi hota.
    // Fallback AP (WiFi fail) har AP_RETRY_INTERVAL_MS pe station
    // connect try karta hai — milte hi AP chhod ke wapas.
    if (accessPointMode)
    {
        if (setupAccessPoint)
            return;

        if (!connecting && (long)(millis() - apRetryDue) >= 0)
        {
            Logger::wifi("AP mode — WiFi rechecking...");
            WiFi.softAPdisconnect(true);
            accessPointMode = false;
            // AP band kiya hai — ab station reconnect me apkeep on ho toh
            // dual AP dobara start ho (stale flag galat AP-off na rakhe)
            dualApActive = false;
            apRetryDue = millis() + AP_RETRY_INTERVAL_MS;
            beginConnect();
        }

        return;
    }

    if (WiFi.status() == WL_CONNECTED)
    {
        if (connecting)
        {
            connecting = false;
            LedManager::setMode(LedManager::HEARTBEAT);
            Logger::success("WiFi Connected");

            Serial.print("IP : ");
            Serial.println(WiFi.localIP());

            startMDNS();
            ensureDualAP();
        }

        return;
    }

    // Connection chal raha hai — bas poll karo, loop block mat karo.
    // Switch aur web server is dauran bhi instant kaam karte hain.
    if (connecting)
    {
        if (millis() - connectStartedAt > WIFI_TIMEOUT_MS)
        {
            Logger::error("WiFi Connection Timeout");
            WiFi.disconnect(true);
            connecting = false;

            // AP-mode retry fail hua — wapas AP, agla attempt 5 min baad
            Logger::warning("Switching To AP Mode");
            startAccessPoint();
        }

        return;
    }

    if (millis() - previousMillis < RECONNECT_DELAY_MS)
        return;

    previousMillis = millis();

    Logger::warning("WiFi Lost");

    accessPointMode = false;
    beginConnect();
}

bool isSetupAccessPoint() {
  return setupAccessPoint;
}

bool isConnected() {
  return WiFi.status() == WL_CONNECTED;
}

void disconnect() {
  WiFi.disconnect(true);
}

String getIP() {
  if (WiFi.status() == WL_CONNECTED)
    return WiFi.localIP().toString();

  return WiFi.softAPIP().toString();
}

String getSSID() {
  return WiFi.SSID();
}

// ==================================================
// Dual-mode (AP + STA ek saath)
//
// WiFi connect hone ke baad bhi saved AP ON rehta hai — device
// 192.168.4.1 (AP) aur LAN IP dono pe reachable. Web server 0.0.0.0
// pe bind hai, isliye dono interface pe kaam karta hai. Isse fresh
// setup ke baad IP dhoondhne ki zaroorat khatam — phone se AP judke
// 192.168.4.1 kholo, ya LAN pe switchnest-xxxxxx.local.
// ==================================================
void ensureDualAP()
{
    // Pehle se kisi AP mode mein ho (setup/fallback) — dual nahi
    if (accessPointMode)
        return;

    if (!PreferencesManager::getAPKeepEnabled())
    {
        if (dualApActive)
        {
            WiFi.softAPdisconnect(true);
            dualApActive = false;
            Logger::wifi("Dual AP disabled");
        }
        return;
    }

    if (dualApActive)
        return;

    if (WiFi.status() != WL_CONNECTED)
        return;

    Logger::wifi("Dual mode: keeping AP active");

    startDualSoftAP();
}

bool isDualMode()
{
    return dualApActive && !accessPointMode && (WiFi.status() == WL_CONNECTED);
}

String getAPIP()
{
    if (dualApActive)
        return WiFi.softAPIP().toString();

    return "";
}

String getAPSSID()
{
    if (!dualApActive)
        return "";

    String apName = PreferencesManager::getAPName();

    if (apName.isEmpty()) {
        String serial = PreferencesManager::getSerialCode();
        if (!serial.isEmpty())
            return "SwitchNest-" + serial;
        return DEFAULT_AP_SSID;
    }

    return apName;
}

String getHostname()
{
    return mdnsHostname;
}

}