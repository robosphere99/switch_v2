#include "web/DashboardPage.h"
#include "web/UI.h"
#include <WiFi.h>

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
    const String &hostname)
{
    String html;

    html += uiHead("Dashboard - Robosphere IoT");

    html += uiNav("/dashboard");

    html += R"rawliteral(
<div class="card">
<h2>Dashboard</h2>
)rawliteral";

    html += "<div class='info'><b>🖥 Board</b><span>";
    html += boardName;
    html += "</span></div>";

    html += "<div class='info'><b>📶 WiFi</b><span id='wifi'>";
    html += ssid;
    html += "</span></div>";

    html += "<div class='info'><b>IP</b><span id='ip'>";
    html += ip;
    html += "</span></div>";

    // Dual-mode (AP + WiFi ek saath) — user ko AP IP + hostname dikhao,
    // taaki IP dhoondhne ki zaroorat na pade.
    if (dualMode)
    {
        html += "<div class='info'><b>🎯 Setup AP</b><span id='apip'>";
        html += apIp;
        html += " (";
        html += apSsid;
        html += ")</span></div>";

        if (!hostname.isEmpty())
        {
            html += "<div class='info'><b>🌐 Host</b><span id='aphost'>";
            html += hostname;
            html += ".local</span></div>";
        }
    }

    // Offline/local mode — user ko clear batana hai ki switch aur yeh panel
    // se control hamesha chalta hai (WiFi/cloud down ho tab bhi).
    if (WiFi.status() != WL_CONNECTED)
    {
        html += "<div class='info'><b>⚠️ Mode</b><span class='ap-badge'>AP Mode";
        if (!setupAccessPoint)
            html += " — auto-reconnect active";
        html += "</span></div>";

        html += R"rawliteral(
<div class="offline-banner">📴 WiFi OFF — Local Mode: switch aur is panel se ON/OFF chalta hai, cloud sync baad me ho jayega</div>
)rawliteral";
    }

    html += "<div class='info'><b>Server</b><span>";
    html += serverConnected ? "✅ Connected" : "❌ Not Connected";
    html += "</span></div>";

    html += "<div class='info'><b>📦 Devices</b><span id='devices'>";
    html += totalDevices;
    html += "</span></div>";

    html += "<div class='info'><b>🔗 Mapping</b><span><span id='mapping'>";
    html += mappedRelays;
    html += "</span> / ";
    html += totalRelays;
    html += " Relays</span></div>";

    html += "<div class='info'><b>Firmware</b><span>";
    html += version;
    html += "</span></div>";

    html += R"rawliteral(
<div class="info"><b>🔌 Relays</b></div>

<div id="relays" class="relay-grid"></div>

<hr>

<p>© Robosphere IoT — Made by Anil Alok</p>

</div>

<script>
setInterval(loadStatus,2000);

function loadStatus()
{
    fetch("/status")
    .then(r=>r.json())
    .then(data=>{

        if(data.ssid !== undefined) {
            document.getElementById("wifi").innerHTML = data.ssid + " (" + data.rssi + " dBm)";
        }

        if(data.ip !== undefined) {
            document.getElementById("ip").innerHTML = data.ip;
        }

        if(data.dualMode !== undefined && data.dualMode) {
            if(data.apIp !== undefined && document.getElementById("apip")) {
                document.getElementById("apip").innerHTML = data.apIp + " (" + data.apSsid + ")";
            }
            if(data.hostname !== undefined && document.getElementById("aphost")) {
                document.getElementById("aphost").innerHTML = data.hostname + ".local";
            }
        }

        if(data.devices !== undefined) {
            document.getElementById("devices").innerHTML = data.devices;
        }

        if(data.mappedRelays !== undefined) {
            document.getElementById("mapping").innerHTML = data.mappedRelays;
        }

        if(data.relays !== undefined) {
            renderRelays(data.relays, data.relayNames);
        }

    })
    .catch(()=>{});
}

function relayCardHtml(i, state, name)
{
    var devName = (name && name.length > 0) ? name : "Unmapped";

    var card = "<div class='relay-card ";
    card += state ? "on" : "off";
    card += "' id='relay-" + i + "' onclick='toggleRelay(" + i + ")'>";
    card += "<div class='r-top'>";
    card += "<span class='r-name'>R" + (i+1) + "</span>";
    card += "<span class='r-badge'>" + (state ? "● ON" : "○ OFF") + "</span>";
    card += "</div>";
    card += "<div class='r-device'><span class='dot'></span>";
    card += devName;
    card += "</div>";
    card += "<div class='r-hint'>Tap to toggle</div>";
    card += "</div>";

    return card;
}

function renderRelays(states, names)
{
    var box = document.getElementById("relays");

    if(!box || !states)
        return;

    var html = "";

    for(var i = 0; i < states.length; i++)
    {
        var name = (names && i < names.length) ? names[i] : "";
        html += relayCardHtml(i, states[i], name);
    }

    box.innerHTML = html;
}

function toggleRelay(index)
{
    fetch("/relay/toggle", {
        method: "POST",
        headers: {"Content-Type":"application/x-www-form-urlencoded"},
        body: "index=" + index
    })
    .then(r=>r.json())
    .then(data=>{
        if(data.success && data.state !== undefined) {
            var card = document.getElementById("relay-" + index);

            if(card) {
                card.outerHTML = relayCardHtml(index, data.state, data.deviceName || "");
            }
        }
    })
    .catch(()=>{});
}
</script>
)rawliteral";

    html += uiEnd();

    return html;
}
