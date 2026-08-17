#include "core/TimeManager.h"
#include "web/WiFiPage.h"
#include "core/WiFiScanner.h"
#include "web/SystemPage.h"
#include "core/BoardManager.h"
#include "core/DeviceManager.h"
#include "core/MappingManager.h"
#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ESP.h>
#include "core/OTAManager.h"
#include "Config.h"
#include "core/Logger.h"
#include "preferences/PreferencesManager.h"
#include "core/LedManager.h"
#include "core/WebServerManager.h"
#include "web/DashboardPage.h"
#include "core/WiFiManager.h"
#include "web/ServerPage.h"
#include <HTTPClient.h>
#include "core/ApiManager.h"
#include "core/DeviceManager.h"
#include "core/StatusManager.h"
#include "core/RelayManager.h"
#include "web/UI.h"
#include "web/UIResources.h"
WebServer server(80);

// ==================================================
// Session-based authentication (per-client)
// Login pe random token ban ke browser cookie mein save hota hai.
// Har request pe cookie validate hoti hai — global isLoggedIn hata diya.
// ==================================================
#define MAX_SESSIONS 4
#define SESSION_TIMEOUT_MS 3600000UL // 1 hour inactivity

struct Session
{
    char token[33];
    unsigned long lastSeen;
    bool active;
};

Session sessions[MAX_SESSIONS] = {};

String generateSessionToken()
{
    String token = "";
    bool unique = false;

    while (!unique)
    {
        token = "";

        for (int i = 0; i < 32; i++)
        {
            token += String((uint8_t)esp_random() % 16, HEX);
        }

        unique = true;

        for (int i = 0; i < MAX_SESSIONS; i++)
        {
            if (sessions[i].active && strcmp(sessions[i].token, token.c_str()) == 0)
            {
                unique = false;
                break;
            }
        }
    }

    return token;
}

void purgeExpiredSessions()
{
    unsigned long now = millis();

    for (int i = 0; i < MAX_SESSIONS; i++)
    {
        if (sessions[i].active && (now - sessions[i].lastSeen > SESSION_TIMEOUT_MS))
        {
            sessions[i].active = false;
        }
    }
}

String createSession()
{
    purgeExpiredSessions();

    String token = generateSessionToken();
    int slot = -1;

    for (int i = 0; i < MAX_SESSIONS; i++)
    {
        if (!sessions[i].active)
        {
            slot = i;
            break;
        }
    }

    if (slot == -1)
    {
        // Saare slots full — sabse purani session overwrite
        slot = 0;

        for (int i = 1; i < MAX_SESSIONS; i++)
        {
            if (sessions[i].lastSeen < sessions[slot].lastSeen)
            {
                slot = i;
            }
        }
    }

    strncpy(sessions[slot].token, token.c_str(), 32);
    sessions[slot].token[32] = '\0';
    sessions[slot].lastSeen = millis();
    sessions[slot].active = true;

    return token;
}

void destroySession(const String &token)
{
    for (int i = 0; i < MAX_SESSIONS; i++)
    {
        if (sessions[i].active && strcmp(sessions[i].token, token.c_str()) == 0)
        {
            sessions[i].active = false;
            return;
        }
    }
}

String getCookieSessionToken()
{
    String cookie = server.header("Cookie");
    int idx = cookie.indexOf("session=");

    if (idx < 0)
        return "";

    String rest = cookie.substring(idx + 8);
    int end = rest.indexOf(';');

    if (end >= 0)
        rest = rest.substring(0, end);

    rest.trim();

    return rest;
}

bool isValidSession(const String &token)
{
    if (token.length() != 32)
        return false;

    unsigned long now = millis();

    for (int i = 0; i < MAX_SESSIONS; i++)
    {
        if (sessions[i].active && strcmp(sessions[i].token, token.c_str()) == 0)
        {
            if (now - sessions[i].lastSeen > SESSION_TIMEOUT_MS)
            {
                sessions[i].active = false;
                return false;
            }

            sessions[i].lastSeen = now;
            return true;
        }
    }

    return false;
}

void handleRoot();
void handleSetup();
void handleLogin();
void handleDashboard();
void handleSave();
void handleLogout();
void handleLoginPost();
void handleServer();
void handleServerSave();
void handleServerTest();
void handleLogout();
void handleSystem();
void handleSystemLed();
void handleWiFi();
void handleWiFiSave();
bool checkLogin()
{
    String token = getCookieSessionToken();

    if (!token.isEmpty() && isValidSession(token))
        return true;

    server.sendHeader("Location", "/");
    server.send(303);

    return false;
}

void handleRoot() {
  if (!PreferencesManager::isConfigured()) {
    handleSetup();
    return;
  }

  handleLogin();
}

void handleSetup() {
  String html;

  html += uiHead("Setup - SwitchNest IoT");

  html += uiAuthBegin();

  // Provisioning tool se set kiye gaye defaults pre-fill karo —
  // buyer apne hisaab se change kar sakta hai.
  String defAdminUser = PreferencesManager::getAdminUsername();
  String defAdminPass = PreferencesManager::getAdminPassword();

  defAdminUser.replace("&", "&amp;");
  defAdminUser.replace("<", "&lt;");
  defAdminUser.replace(">", "&gt;");
  defAdminUser.replace("\"", "&quot;");
  defAdminPass.replace("&", "&amp;");
  defAdminPass.replace("<", "&lt;");
  defAdminPass.replace(">", "&gt;");
  defAdminPass.replace("\"", "&quot;");

  // Server URL/API — provisioning tool se pre-set ho toh pre-fill dikhe
  String defServerUrl = PreferencesManager::getServerURL();
  String defApiKey = PreferencesManager::getApiKey();
  defServerUrl.replace("&", "&amp;");
  defServerUrl.replace("<", "&lt;");
  defServerUrl.replace(">", "&gt;");
  defServerUrl.replace("\"", "&quot;");
  defApiKey.replace("&", "&amp;");
  defApiKey.replace("<", "&lt;");
  defApiKey.replace(">", "&gt;");
  defApiKey.replace("\"", "&quot;");

  html += R"rawliteral(
<div class="glass auth-card">
<div class="logo">⚡</div>
<h1>SwitchNest IoT</h1>
<p class="sub">Setup your device</p>

<h3 class="sectionTitle">Restore Previous Configuration</h3>

<label class="file-box" for="configFile">
<span>📂</span>
<input type="file" id="configFile" accept=".json">
<span class="file-name" id="configFileName">No file selected</span>
</label>

<button type="button" class="success" onclick="restoreBackup()">Restore Backup</button>

<div class="divider-text">OR</div>

<form action="/save" method="POST">

<label>Admin Username</label>

<input
name="admin_user"
type="text"
placeholder="admin"
value="";
html += defAdminUser;
html += R"rawliteral("
required>

<label>Admin Password</label>

<input
name="admin_pass"
type="password"
placeholder="Password"
value="";
html += defAdminPass;
html += R"rawliteral("
required>

<label>WiFi Network</label>

<div class="field-row">

<select
id="wifi_ssid"
name="wifi_ssid"
required>
<option value="">Scanning...</option>
</select>

<button type="button" class="btn-sm ghost" onclick="scanWifi()">⟳ Refresh</button>

</div>

<label>WiFi Password</label>

<input
name="wifi_pass"
type="password"
placeholder="WiFi password"
required>

<label>Server URL (optional — devices sync ke liye)</label>

<input
name="server_url"
type="text"
placeholder="https://yourserver.com/api/"
value="";
html += defServerUrl;
html += R"rawliteral("
>

<label>API Key (optional)</label>

<input
name="api_key"
type="text"
placeholder="API key"
value="";
html += defApiKey;
html += R"rawliteral("
>

<button type="submit">Save Configuration</button>

</form>

<p class="hint">💡 Save ke baad device WiFi se connect hoga — aur AP (192.168.4.1) bhi ON rahega, isliye IP dhoondhne ki zaroorat nahi.</p>

</div>
<script>

document.getElementById("configFile").addEventListener("change", function(){
    var f = this.files[0];
    document.getElementById("configFileName").textContent = f ? f.name : "No file selected";
});

async function restoreBackup()
{
    const file=document.getElementById("configFile").files[0];

    if(!file)
    {
        alert("Please select a backup file.");
        return;
    }

    let text;

    try
    {
        text=await file.text();
    }
    catch(e)
    {
        alert("Unable to read file.");
        return;
    }

    let config;

    try
    {
        config=JSON.parse(text);
    }
    catch(e)
    {
        alert("Invalid JSON File.");
        return;
    }

    if(
        config.configVersion===undefined ||
        config.wifi===undefined ||
        config.server===undefined ||
        config.admin===undefined ||
        config.mapping===undefined
    )
    {
        alert("This is not a SwitchNest configuration file.");
        return;
    }

    let summary =
    "Restore Configuration?\n\n"+
    "WiFi : " + config.wifi.ssid +
    "\nAdmin : " + config.admin.username +
    "\n\nExisting configuration will be overwritten.";

    if(!confirm(summary))
        return;

    fetch("/config/import",
    {
        method:"POST",
        headers:
        {
            "Content-Type":"application/json"
        },
        body:text
    })
    .then(r=>r.json())
    .then(data=>
    {
        alert(data.message);
    })
    .catch(()=>
    {
        alert("Restore Failed");
    });
}
async function scanWifi()
{
    const select=document.getElementById("wifi_ssid");

    select.innerHTML="<option>Scanning...</option>";

    try
    {
        const response=await fetch("/wifi/scan");

        const list=await response.json();

        select.innerHTML="";

        if(list.length==0)
        {
            select.innerHTML=
            "<option value=''>No Networks Found</option>";
            return;
        }

        list.forEach(function(network)
{
    let option = document.createElement("option");

    option.value = network.ssid;

    option.textContent =
        "📶 " + network.ssid +
        " (" + network.rssi + " dBm)";

    select.appendChild(option);
});
    }
    catch(e)
    {
        select.innerHTML=
        "<option value=''>Scan Failed</option>";
    }
}
    window.onload=function()
{
    scanWifi();
}
</script>
)rawliteral";

  html += uiEnd();

  if (!PreferencesManager::isConfigured()) {
    server.send(200, "text/html", html);
    return;
  }

  // Dashboard (temporary)
  server.send(
    200,
    "text/html",
    "<h1>SwitchNest IoT</h1><h2>Device Configured Successfully</h2>");
}
void handleLogin() {
  String html;

  html += uiHead("Login - SwitchNest IoT");

  html += uiAuthBegin();

  html += R"rawliteral(
<div class="glass auth-card">
<div class="logo">⚡</div>
<h1>SwitchNest IoT</h1>
<p class="sub">Smart Switch Controller</p>
<form action="/login" method="POST">
<label>Username</label>
<input type="text" name="username" placeholder="Username" required>
<label>Password</label>
<input type="password" name="password" placeholder="Password" required>
<button type="submit">Login</button>
</form>
</div>
)rawliteral";

  html += uiEnd();

  server.send(200, "text/html", html);
}
void handleSave() {
  String adminUser = server.arg("admin_user");
  String adminPass = server.arg("admin_pass");

  String wifiSSID = server.arg("wifi_ssid");
  String wifiPass = server.arg("wifi_pass");

  // Setup page se hi server URL + API key — ek hi baar mein sab configure
  PreferencesManager::saveServer(server.arg("server_url"), server.arg("api_key"));

  PreferencesManager::saveAdmin(adminUser, adminPass);
  PreferencesManager::saveWiFi(wifiSSID, wifiPass);
  PreferencesManager::setConfigured(true);

  String html;
  html += uiHead("Configuration Saved");
  html += uiAuthBegin();
  html += "<div class='glass auth-card msg-card ok'><div class='msg-icon'>✅</div>";
  html += "<h2>Configuration Saved</h2>";
  html += "<p class='msg-sub'>Device restarting... WiFi connect hoga aur AP (192.168.4.1) bhi ON rahega — kisi bhi jagah se khul jayega.</p>";
  html += "</div>";
  html += uiEnd();

  server.send(200, "text/html", html);

  delay(1500);

  ESP.restart();
}
void handleLoginPost() {
  String username = server.arg("username");
  String password = server.arg("password");

  if (username == PreferencesManager::getAdminUsername() && password == PreferencesManager::getAdminPassword()) {
    String token = createSession();

    server.sendHeader("Set-Cookie", "session=" + token + "; Path=/; HttpOnly");
    server.sendHeader("Location", "/dashboard");
    server.send(303);
  } else {
    delay(800); // Brute-force slow down

    String html;
    html += uiHead("Login Failed");
    html += uiAuthBegin();
    html += "<div class='glass auth-card msg-card err'><div class='msg-icon'>❌</div>";
    html += "<h2>Invalid Credentials</h2>";
    html += "<p class='msg-sub'>Username ya password galat hai.</p>";
    html += "<button onclick=\"location.href='/'\">← Try Again</button>";
    html += "</div>";
    html += uiEnd();

    server.send(200, "text/html", html);
  }
}
void handleDashboard()
{
    if (!checkLogin())
        return;

    String html = DashboardPage(
        WiFiManager::getIP(),
        PreferencesManager::getWiFiSSID(),
        FIRMWARE_VERSION,
        DeviceManager::getCount(),
        MappingManager::getMappedCount(),
        BoardManager::getRelayCount(),
        BoardManager::getBoard()->name,
        WiFi.status() == WL_CONNECTED,
        WiFiManager::isSetupAccessPoint(),
        WiFiManager::isDualMode(),
        WiFiManager::getAPIP(),
        WiFiManager::getAPSSID(),
        WiFiManager::getHostname()
    );

    server.send(
        200,
        "text/html",
        html
    );
}
void handleMapping()
{
    if (!checkLogin())
        return;
    Serial.print("Devices : ");
    Serial.println(DeviceManager::getCount());
    String html = "";

    html += uiHead("Relay Mapping");

    html += uiNav("/mapping");

    html += "<div class='card wide'>";

    html += "<h2>Output Mapping</h2>";

    html += "<p class='hint'>Har relay ko server se aaye device se map karo — dashboard pe relay card usi device ka naam dikhayega. Server page se devices download karna mat bhoolna.</p>";

    html += "<form method='POST' action='/mapping/save'>";

    if (DeviceManager::getCount() == 0)
    {
        html += "<div class='notes'>⚠️ Koi device available nahi. Pehle <a href='/server'>Server page</a> se devices download karo.</div>";
    }

    html += "<h3 class='sectionTitle'>Relays</h3>";

    for(uint8_t channel = 0; channel < BoardManager::getRelayCount(); channel++)
{
    html += "<div class='map-row'>";

    html += "<span class='badge'>R";
    html += String(channel + 1);
    html += "</span>";

    html += "<select name='relay";
    html += String(channel);
    html += "'>";

    html += "<option value='-1'>-- Not Mapped --</option>";

    for(int i = 0; i < DeviceManager::getCount(); i++)
    {
        Device *device = DeviceManager::getDevice(i);

        if(device == nullptr)
         continue;

        html += "<option value='";
        html += String(device->id);
        html += "'";

        if(MappingManager::getMapping(channel) == device->id)
        {
            html += " selected";
        }

        html += ">";

        html += device->name;

        html += "</option>";
    }

    html += "</select>";

    html += "</div>";
}

    html += "<h3 class='sectionTitle'>Status LED</h3>";

    html += "<div class='map-row'>";

    html += "<span class='badge'>LED</span>";

    html += "<select name='status_led'>";

    html += "<option value='-1'>-- Not Mapped --</option>";

    for(int i=0;i<DeviceManager::getCount();i++)
{
    Device *device = DeviceManager::getDevice(i);

    if(device==nullptr)
        continue;

    html += "<option value='";
    html += device->id;
    html += "'";

    if(PreferencesManager::getStatusLedMapping()==device->id)
        html += " selected";

    html += ">";

    html += device->name;

    html += "</option>";
}

    html += "</select>";

    html += "</div>";

    html += "<h3 class='sectionTitle'>🎛 Switch Mode</h3>";

    html += "<div class='map-row'>";
    html += "<span class='badge'>SW</span>";
    html += "<select name='switch_mode'>";
    html += "<option value='0'";

    if (PreferencesManager::getSwitchMode() == SWITCH_MODE_MOMENTARY)
        html += " selected";

    html += ">Push Button (momentary)</option>";
    html += "<option value='1'";

    if (PreferencesManager::getSwitchMode() == SWITCH_MODE_TOGGLE)
        html += " selected";

    html += ">Wall Switch (toggle)</option>";
    html += "</select>";
    html += "</div>";
    html += "<p class='hint'>Push Button: dabane pe relay toggle hota hai (release ignore). Wall Switch: har flip pe toggle — dono directions kaam karte hain.</p>";

    html += "<div class='btn-row'>";
    html += "<button type='submit'>💾 Save Mapping</button>";
    html += "<button type='button' class='ghost' onclick=\"location.href='/dashboard'\">Cancel</button>";
    html += "</div>";

    html += "</form>";

    html += uiEnd();

server.send(200, "text/html", html);
}

void handleMappingSave()
{
    if (!checkLogin())
        return;

    Serial.println("========== FORM ==========");

    for(uint8_t channel = 0; channel < BoardManager::getRelayCount(); channel++)
    {
        String field = "relay" + String(channel);

        Serial.print(field);
        Serial.print(" : ");
        Serial.println(server.arg(field));

        int deviceId = server.arg(field).toInt();

        MappingManager::setMapping(channel, deviceId);
    }

    MappingManager::save();
    PreferencesManager::saveStatusLedMapping(server.arg("status_led").toInt());
    PreferencesManager::saveSwitchMode(server.arg("switch_mode").toInt());
    String html;

    html += uiHead("Mapping Saved");
    html += uiAuthBegin();
    html += "<div class='glass auth-card msg-card ok'><div class='msg-icon'>✅</div>";
    html += "<h2>Mapping Saved</h2>";
    html += "<p class='msg-sub'>Relay mapping update ho gaya.</p>";
    html += "<div class='btn-row'><button onclick=\"location.href='/mapping'\">↩ Mapping</button>";
    html += "<button class='ghost' onclick=\"location.href='/dashboard'\">Dashboard</button></div>";
    html += "</div>";
    html += uiEnd();

    server.send(200, "text/html", html);
}

void handleServer()
{
    if (!checkLogin())
        return;
    server.send(
        200,
        "text/html",
        ServerPage(
            PreferencesManager::getServerURL(),
            PreferencesManager::getApiKey()
        )
    );
}
void handleServerSave()
{
    if (!checkLogin())
        return;
    PreferencesManager::saveServer(
        server.arg("server_url"),
        server.arg("api_key")
    );

    server.sendHeader("Location", "/dashboard");
    server.send(303);
}
void handleServerTest()
{
    if (!checkLogin())
        return;

    if (ApiManager::downloadDevices())
    {
        String json = "{\"success\":true,\"message\":\"Connection OK\",\"count\":";
        json += String(DeviceManager::getCount());
        json += "}";
        server.send(200, "application/json", json);
    }
    else
    {
        server.send(200, "application/json",
            "{\"success\":false,\"message\":\"Connection failed — URL/key check karo\"}");
    }
}

void handleLogout()
{
    String token = getCookieSessionToken();

    if (!token.isEmpty())
        destroySession(token);

    server.sendHeader("Set-Cookie", "session=; Path=/; Max-Age=0");
    server.sendHeader("Location", "/");
    server.send(303);
}

void handleDownloadDevices()
{
    if (!checkLogin())
        return;

    if (ApiManager::downloadDevices())
    {
        String json = "{\"success\":true,\"message\":\"Devices downloaded\",\"count\":";
        json += String(DeviceManager::getCount());
        json += "}";
        server.send(200, "application/json", json);
    }
    else
    {
        server.send(200, "application/json",
            "{\"success\":false,\"message\":\"Download failed\"}");
    }
}

void handleSystem()
{
    if(!checkLogin())
        return;

    server.send(
        200,
        "text/html",
        SystemPage(
            BoardManager::getBoard()->name,
            PreferencesManager::getSerialCode(),
            FIRMWARE_VERSION,
            WiFi.localIP().toString(),
            millis()/1000,
            ESP.getFreeHeap(),

            TimeManager::getDate(),
            TimeManager::getTime(),
            TimeManager::getDay(),
            TimeManager::isSynced(),

            OTAManager::getCurrentVersion(),
            OTAManager::getLatestVersion(),
            OTAManager::getStatus(),
            OTAManager::getReleaseNotes(),
            OTAManager::getProgress(),
            PreferencesManager::getOTAURL(),
            LedManager::isEnabled()
        )
    );
}

void handleSystemLed()
{
    if(!checkLogin())
        return;

    // JSON body: { "enabled": true/false }
    String body = server.arg("plain");

    bool enabled = true;

    if (body.indexOf("\"enabled\":false") >= 0)
        enabled = false;

    LedManager::setUserEnabled(enabled);

    String json = "{\"success\":true,\"ledEnabled\":";
    json += enabled ? "true" : "false";
    json += "}";
    server.send(200, "application/json", json);
}

void handleWiFi()
{
    if(!checkLogin())
        return;

    server.send(
        200,
        "text/html",
        WiFiPage(
            PreferencesManager::getWiFiSSID(),
            WiFiScanner::getNetworkOptions(),
            PreferencesManager::getAPName(),
            PreferencesManager::getAPPassword()
        )
    );
}

void handleWiFiSave()
{
    if(!checkLogin())
        return;

    String ssid =
        server.arg("wifi_ssid");

    String password =
        server.arg("wifi_password");

    // Hotspot (AP) edit — user login karke apna AP naam/password change kar sakta hai.
    String apName = server.arg("ap_name");
    String apPassword = server.arg("ap_password");

    PreferencesManager::saveWiFi(
        ssid,
        password
    );
    PreferencesManager::saveAPName(apName);
    PreferencesManager::saveAPPassword(apPassword);

    String html;
    html += uiHead("Settings Saved");
    html += uiAuthBegin();
    html += "<div class='glass auth-card msg-card ok'><div class='msg-icon'>📶</div>";
    html += "<h2>Settings Saved</h2>";
    html += "<p class='msg-sub'>WiFi + Hotspot saved. Device restarting... naye network se connect hone ka wait karo.</p>";
    html += "</div>";
    html += uiEnd();

    server.send(200, "text/html", html);

    delay(1500);

    ESP.restart();
}

namespace WebServerManager {

void begin()
{
    server.on("/", HTTP_GET, handleRoot);

    server.on("/save", HTTP_POST, handleSave);

    server.on("/login", HTTP_POST, handleLoginPost);

    server.on("/dashboard", HTTP_GET, handleDashboard);

    server.on("/server", HTTP_GET, handleServer);

    server.on("/server/download", HTTP_GET, handleDownloadDevices);

    server.on("/mapping", HTTP_GET, handleMapping);

    server.on("/mapping/save", HTTP_POST, handleMappingSave);

    server.on("/server/save", HTTP_POST, handleServerSave);

    server.on("/server/test", HTTP_GET, handleServerTest);
    server.on("/status", HTTP_GET, []()
{
    if (!checkLogin())
        return;

    server.send(200,
                "application/json",
                StatusManager::getJson());
});
    server.on("/relay/toggle", HTTP_POST, []()
{
    if (!checkLogin())
        return;

    int index = server.arg("index").toInt();

    if (index < 0 || index >= BoardManager::getRelayCount())
    {
        server.send(400, "application/json",
                    "{\"success\":false,\"message\":\"Invalid Relay Index\"}");
        return;
    }

    RelayManager::toggle(index);

    bool state = RelayManager::getState(index);

    int deviceId = MappingManager::getDeviceIdByRelay(index);

    bool pushed = true;

    if (deviceId != -1)
    {
        // Server ko state push karo (physical switch jaisa hi)
        // Debounced batch queue — short interval ke updates ek saath jaate hain
        pushed = ApiManager::queueDeviceUpdate(deviceId, state);
    }

    // Mapped device ka naam — dashboard card update ke liye
    String deviceName = "";

    if (deviceId != -1)
    {
        for (int d = 0; d < DeviceManager::getCount(); d++)
        {
            Device *device = DeviceManager::getDevice(d);

            if (device != nullptr && device->id == deviceId)
            {
                deviceName = device->name;
                break;
            }
        }
    }

    String json = "{\"success\":true,\"index\":";
    json += String(index);
    json += ",\"state\":";
    json += state ? "true" : "false";
    json += ",\"pushed\":";
    json += pushed ? "true" : "false";
    json += ",\"deviceName\":\"";
    json += deviceName;
    json += "\"}";

    server.send(200, "application/json", json);
});
    server.on("/logout", HTTP_GET, handleLogout);
    server.on("/system", HTTP_GET, handleSystem);
    server.on("/system/led", HTTP_POST, handleSystemLed);
    server.on("/wifi", HTTP_GET, handleWiFi);
    server.on("/wifi/save", HTTP_POST, handleWiFiSave);
    server.on("/config/export", HTTP_GET, []()
{
    if (!checkLogin())
        return;

    String json = PreferencesManager::exportConfiguration();

    String fileName = server.arg("name");

if(fileName.isEmpty())
    fileName = "SwitchNest_Config";

server.sendHeader(
    "Content-Disposition",
    "attachment; filename=\"" +
    fileName +
    ".json\""
);

server.send(
    200,
    "application/json",
    json
);
});
    server.on("/config/import", HTTP_POST, []()
{
    if (!checkLogin())
        return;

    String json = server.arg("plain");

    if(json.length() == 0)
    {
        server.send(400, "application/json",
                    "{\"success\":false,\"message\":\"Empty Body\"}");
        return;
    }

    if(!PreferencesManager::validateConfiguration(json))
    {
        server.send(400, "application/json",
                    "{\"success\":false,\"message\":\"Invalid Configuration\"}");
        return;
    }

    if(!PreferencesManager::importConfiguration(json))
    {
        server.send(500, "application/json",
                    "{\"success\":false,\"message\":\"Import Failed\"}");
        return;
    }

    server.send(200, "application/json",
                "{\"success\":true,\"message\":\"Configuration Imported\"}");
    delay(2000);
    ESP.restart();
});
    server.on("/restart", HTTP_GET, []()
{
    if (!checkLogin())
        return;

    server.send(
        200,
        "text/html",
        "<h2>Restarting Device...</h2>"
    );

    delay(1000);

    ESP.restart();
});

server.on("/reset", HTTP_GET, []()
{
    if (!checkLogin())
        return;

    PreferencesManager::factoryReset();

    server.send(
        200,
        "text/html",
        "<h2>Factory Reset Complete.<br>Restarting Device...</h2>"
    );

    delay(2000);

    ESP.restart();
});

server.on("/wifi/scan", HTTP_GET, []()
{
    // Setup mode (device configured nahi) mein bina login ke scan allowed — setup page isi pe depend karta hai
    if (PreferencesManager::isConfigured() && !checkLogin())
        return;

    int n = WiFi.scanNetworks();

    String json = "[";

bool first = true;

for(int i=0;i<n;i++)
{
    String ssid = WiFi.SSID(i);

    if(ssid=="")
        continue;

    bool duplicate=false;

    for(int j=0;j<i;j++)
    {
        if(WiFi.SSID(j)==ssid)
        {
            duplicate=true;
            break;
        }
    }

    if(duplicate)
        continue;

    if(!first)
        json += ",";

    first = false;

    json += "{";
    json += "\"ssid\":\"" + ssid + "\",";
    json += "\"rssi\":" + String(WiFi.RSSI(i));
    json += "}";
}

json+="]";

    server.send(200,"application/json",json);
});

server.on("/ota/check", HTTP_GET, []()
{
    if (!checkLogin())
        return;

    OTAManager::checkUpdate();

    server.send(200,"text/plain","OK");
});

server.on("/ota/update", HTTP_POST, []()
{
    if (!checkLogin())
        return;

    server.send(200, "application/json",
                "{\"success\":true,\"message\":\"OTA Started\"}");

    delay(100);

    OTAManager::startUpdate();
});

// Dashboard se firmware URL save karo (NVS mein persist — default check URL ban jata hai)
server.on("/ota/seturl", HTTP_POST, []()
{
    if (!checkLogin())
        return;

    String url = server.arg("url");
    url.trim();

    // Empty URL = clear karo (default OTA_CHECK_URL wapas)
    PreferencesManager::saveOTAURL(url);

    String msg = url.isEmpty()
                     ? "OTA URL cleared — default check URL wapas"
                     : "OTA URL saved — ab Check Update isi URL se hoga";

    String json = "{\"success\":true,\"message\":\"";
    json += msg;
    json += "\"}";

    server.send(200, "application/json", json);
});

// Seedha .bin URL se update — ghar pe installed device ko kahin se bhi update karne ke liye
server.on("/ota/update-url", HTTP_POST, []()
{
    if (!checkLogin())
        return;

    String url = server.arg("url");
    url.trim();

    if (url.isEmpty())
    {
        server.send(200, "application/json",
                    "{\"success\":false,\"message\":\"URL empty\"}");
        return;
    }

    server.send(200, "application/json",
                "{\"success\":true,\"message\":\"OTA Started from URL — device restart hogi\"}");

    delay(100);

    OTAManager::startUpdateFromURL(url);
});

server.on("/ota/status", HTTP_GET, []()
{
    if (!checkLogin())
        return;

    String json="{ ";

    json+="\"current\":\"";
    json+=OTAManager::getCurrentVersion();
    json+="\",";

    json+="\"latest\":\"";
    json+=OTAManager::getLatestVersion();
    json+="\",";

    json+="\"progress\":";
    json+=String(OTAManager::getProgress());
    json+=",";

    json+="\"status\":\"";
    json+=OTAManager::getStatus();
    json+="\",";

    json+="\"releaseNotes\":\"";
    json+=OTAManager::getReleaseNotes();
    json+="\",";

    json+="\"available\":";
    json+=OTAManager::isUpdateAvailable()?"true":"false";

    json+="}";

    server.send(200,"application/json",json);
});


    // Session cookie ko request headers mein collect karne ke liye zaroori hai
    // (ESP32 WebServer default mein sirf Authorization header collect karta hai)
    const char *headerKeys[] = {"Cookie"};
    server.collectHeaders(headerKeys, 1);

    // Shared UI resources (glassmorphism design system + theme JS)
    server.on("/style.css", HTTP_GET, []()
{
    server.send(200, "text/css", STYLE_CSS);
});
    server.on("/app.js", HTTP_GET, []()
{
    server.send(200, "application/javascript", APP_JS);
});

    server.begin();

    Logger::success("Web Server Started");
}

void update() {
  server.handleClient();
}



}