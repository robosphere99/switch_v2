#include "web/SystemPage.h"
#include "web/UI.h"

String formatUptime(uint32_t sec)
{
    uint32_t d = sec / 86400;
    sec %= 86400;

    uint32_t h = sec / 3600;
    sec %= 3600;

    uint32_t m = sec / 60;
    sec %= 60;

    String s;

    if (d)
        s += String(d) + "d ";

    if (h)
        s += String(h) + "h ";

    if (m)
        s += String(m) + "m ";

    s += String(sec) + "s";

    return s;
}

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
    bool ledEnabled)
{
    String html;

    html += uiHead("System - SwitchNest IoT");

    html += uiNav("/system");

    html += R"rawliteral(
<div class="card wide">
<h2>System</h2>

<h3 class="sectionTitle">🖥 Device Info</h3>
)rawliteral";

    html += "<div class='info'><b>Board</b><span>" + board + "</span></div>";
    html += "<div class='info'><b>Firmware</b><span>" + firmware + "</span></div>";
    html += "<div class='info'><b>IP</b><span>" + ip + "</span></div>";
    html += "<div class='info'><b>Uptime</b><span>" + formatUptime(uptime) + "</span></div>";
    html += "<div class='info'><b>Free Heap</b><span>" + String(freeHeap / 1024) + " KB</span></div>";

    html += "<div class='info'><b>Date</b><span id='date'>" + date + "</span></div>";
    html += "<div class='info'><b>Time</b><span id='time'>" + time + "</span></div>";
    html += "<div class='info'><b>Day</b><span id='day'>" + day + "</span></div>";

    html += "<div class='info'><b>Time Sync</b><span>";
    html += synced ? "✅ Yes" : "❌ No";
    html += "</span></div>";

    html += R"rawliteral(
<h3 class="sectionTitle">💡 Status LED</h3>
<p class="hint">Board ki status LED — connectivity blinks dikhata hai. Chaho toh band kar do (raat me dim light pasand nahi aati).</p>
<div class="btn-row">
)rawliteral";
    if (ledEnabled)
    {
        html += "<span class=\"badge-green\">🟢 LED ON</span> ";
        html += "<button class=\"orange\" onclick=\"toggleLed(false)\">🔴 Turn Off</button>";
    }
    else
    {
        html += "<span class=\"badge-red\">⚫ LED OFF</span> ";
        html += "<button class=\"green\" onclick=\"toggleLed(true)\">🟢 Turn On</button>";
    }
    html += R"rawliteral(
</div>
<div id="ledResult"></div>

<h3 class="sectionTitle">📦 Firmware Update (OTA)</h3>

<div class="info"><b>Current Version</b><span id="currentVersion">)rawliteral";
    html += currentVersion;
    html += R"rawliteral(</span></div>

<div class="info"><b>Latest Version</b><span id="latestVersion">)rawliteral";
    html += latestVersion;
    html += R"rawliteral(</span></div>

<div class="info"><b>Status</b><span id="otaStatus">)rawliteral";
    html += otaStatus;
    html += R"rawliteral(</span></div>

<div class="info"><b>Release Notes</b><div class="notes" id="releaseNotes">)rawliteral";
    html += releaseNotes;
    html += R"rawliteral(</div></div>

<progress id="progressBar" value=")rawliteral";
    html += String(otaProgress);
    html += R"rawliteral(" max="100"></progress>

<div id="progressText" style="text-align:center;margin-top:5px;">)rawliteral";
    html += String(otaProgress);
    html += "%";
    html += R"rawliteral(</div>

<div class="btn-row">
<button class="blue" onclick="checkOTA()">🔍 Check Update</button>
<button class="orange" id="updateBtn" onclick="startOTA()">⬇ Update Firmware</button>
</div>

<h3 class="sectionTitle">🔗 Firmware URL (Remote Update)</h3>
<p class="hint">Ghar pe installed device ko kahin se bhi update karo — apna firmware <b>.bin</b> URL (ya version.json URL) yahan daalo. Save karo toh wahi default check URL ban jata hai.</p>

<label>Firmware URL</label>
<input type="text" id="otaUrl" value="" placeholder="https://your-server.com/firmware.bin">

<div class="btn-row">
<button class="gray" onclick="saveOtaUrl()">💾 Save URL</button>
<button class="orange" onclick="updateFromUrl()">⬇ Update from URL</button>
</div>

<div id="otaUrlResult"></div>

<h3 class="sectionTitle">💾 Backup &amp; Restore</h3>

<label>Backup Name</label>
<input type="text" id="backupName" placeholder="SwitchNest_Config">

<button class="blue" onclick="downloadConfig()">⬇ Download Backup</button>

<label class="file-box" for="configFile">
<span>📂</span>
<input type="file" id="configFile" accept=".json" onchange="fileSelected()">
<span class="file-name" id="configFileName">No file selected</span>
</label>

<button class="blue" id="restoreBtn" onclick="uploadConfig()" disabled>↩ Restore Configuration</button>

<div class="zone-danger">
<h3>⚠️ Danger Zone</h3>
<p class="hint">Restart se device reboot hoti hai. Factory Reset se WiFi, server, admin aur mapping — sab erase ho jata hai.</p>
<div class="btn-row">
<button class="orange" onclick="location.href='/restart'">🔁 Restart Device</button>
<button class="red" onclick="confirmReset()">🗑 Factory Reset</button>
</div>
</div>

</div>

<script>

function downloadConfig()
{
    let name =
    document.getElementById("backupName")
    .value
    .trim();

    if(name=="")
        name="SwitchNest_Config";

    // Remove invalid filename characters
    name=name.replace(/[\\/:*?"<>|]/g,"_");

    const now=new Date();

    const timestamp=
    now.getFullYear()+"-"+
    String(now.getMonth()+1).padStart(2,"0")+"-"+
    String(now.getDate()).padStart(2,"0")+"_"+

    String(now.getHours()).padStart(2,"0")+"-"+
    String(now.getMinutes()).padStart(2,"0")+"-"+
    String(now.getSeconds()).padStart(2,"0");

    const fileName=
    name+"_"+timestamp;

    window.location.href=
    "/config/export?name="+
    encodeURIComponent(fileName);
}


    async function toggleLed(on)
    {
        const res = await fetch("/system/led", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled: on })
        });
        const data = await res.json().catch(() => ({}));
        if (data.success)
        {
            location.reload();
        }
        else
        {
            document.getElementById("ledResult").innerHTML =
            '<p style="color:red">Failed to toggle LED</p>';
        }
    }

    async function uploadConfig()
{
    const file=document.getElementById("configFile").files[0];

    if(!file)
    {
        alert("Please select a configuration file.");
        return;
    }

    const text=await file.text();

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
    .catch(err=>
    {
        alert("Import Failed");
    });
}
    function fileSelected()
{
    const file=document.getElementById("configFile").files[0];

    const btn=document.getElementById("restoreBtn");

    btn.disabled=!file;

    document.getElementById("configFileName").textContent =
        file ? file.name : "No file selected";
}
function confirmReset()
{
    if(confirm(
        "⚠️ Factory Reset?\n\n" +
        "This will erase:\n" +
        "• WiFi Settings\n" +
        "• Server Settings\n" +
        "• Admin Credentials\n" +
        "• Relay Mapping\n\n" +
        "This action cannot be undone."
    ))
    {
        window.location.href="/reset";
    }
}
    let current = new Date(
    "2026-08-03T" + document.getElementById("time").innerText
);

setInterval(function()
{
    current.setSeconds(current.getSeconds()+1);

    const days=[
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
    ];

    document.getElementById("time").innerText =
        current.toLocaleTimeString("en-GB");

    document.getElementById("date").innerText =
        String(current.getDate()).padStart(2,'0')+"-"+
        String(current.getMonth()+1).padStart(2,'0')+"-"+
        current.getFullYear();

    document.getElementById("day").innerText =
        days[current.getDay()];

},1000);
async function loadOTAStatus()
{
    
    const r = await fetch("/ota/status");

    const data = await r.json();

    document.getElementById("currentVersion").innerText=data.current;

    document.getElementById("latestVersion").innerText=data.latest;

    document.getElementById("otaStatus").innerText=data.status;

    document.getElementById("releaseNotes").innerText= data.releaseNotes || "No Release Notes";

    document.getElementById("progressBar").value=data.progress;
    const status=document.getElementById("otaStatus");

status.innerText=data.status;

status.style.fontWeight="bold";

switch(data.status)
{
    case "Update Available":

        status.style.color="#2E7D32";
        break;

    case "Downloading":

        status.style.color="#FB8C00";
        break;

    case "Success":

        status.style.color="#43A047";
        break;

    case "Failed":

        status.style.color="#E53935";
        break;

    default:

        status.style.color="#1565C0";
}

    if(data.progress==100)
{
    document.getElementById("progressText").innerText="Installing...";
}
else
{
    document.getElementById("progressText").innerText=data.progress+"%";
}

    document.getElementById("updateBtn").disabled=!data.available;
}

// OTA URL input ko saved URL se prefill karo
(function(){
    var saved = ")rawliteral";
    html += otaUrl;
    html += R"rawliteral(";
    if(saved && saved.length > 0){
        document.getElementById("otaUrl").value = saved;
    }
})();

function showOtaUrlResult(msg, ok)
{
    var box = document.getElementById("otaUrlResult");
    box.innerHTML = "<div class='notes' style='border-left:4px solid " + (ok ? "#22c55e" : "#ef4444") + "'>" + msg + "</div>";
}

async function saveOtaUrl()
{
    var url = document.getElementById("otaUrl").value.trim();

    if(!url){
        alert("Pehle firmware URL daalo");
        return;
    }

    showOtaUrlResult("Saving URL...", true);

    try {
        var r = await fetch("/ota/seturl", {
            method: "POST",
            headers: {"Content-Type":"application/x-www-form-urlencoded"},
            body: "url=" + encodeURIComponent(url)
        });
        var d = await r.json();
        showOtaUrlResult(d.message, d.success);
    } catch(e) {
        showOtaUrlResult("Save Failed", false);
    }
}

async function updateFromUrl()
{
    var url = document.getElementById("otaUrl").value.trim();

    if(!url){
        alert("Pehle firmware URL daalo");
        return;
    }

    if(!confirm("Is URL se firmware update hoga:\n" + url + "\n\nDevice download + install + restart hogi. Continue?")) return;

    showOtaUrlResult("⬇ Downloading & installing... (device restart hogi)", true);

    try {
        var r = await fetch("/ota/update-url", {
            method: "POST",
            headers: {"Content-Type":"application/x-www-form-urlencoded"},
            body: "url=" + encodeURIComponent(url)
        });
        var d = await r.json();
        showOtaUrlResult(d.message, d.success);
    } catch(e) {
        showOtaUrlResult("Update Failed", false);
    }
}

loadOTAStatus();
setInterval(loadOTAStatus,2000);

async function checkOTA()
{
    const btn=document.querySelector(".blue");

    btn.disabled=true;

    btn.innerText="Checking...";

    try
    {
        await fetch("/ota/check");

        await loadOTAStatus();
    }
    catch(e)
    {
        alert("Check Failed");
    }

    btn.disabled=false;

    btn.innerText="Check Update";
}
async function startOTA()
{
    if(!confirm("Install latest firmware?"))
        return;

    const btn=document.getElementById("updateBtn");

    btn.disabled=true;

    btn.innerText="Updating...";

    try
    {
        const r=await fetch("/ota/update",
        {
            method:"POST"
        });

        const text=await r.text();

        alert(text);
    }
    catch(e)
    {
        alert("OTA Failed");

        btn.disabled=false;

        btn.innerText="Update Firmware";
    }
}
   
</script>
)rawliteral";

    html += uiEnd();

    return html;
}
