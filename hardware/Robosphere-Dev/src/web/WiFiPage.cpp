#include "web/WiFiPage.h"
#include "web/UI.h"

String WiFiPage(
    const String &currentSSID,
    const String &networkOptions,
    const String &currentAPName,
    const String &currentAPPassword)
{
    String html;

    html += uiHead("WiFi Settings");

    html += uiNav("/wifi");

    html += R"rawliteral(
<div class="card">
<h2>WiFi Settings</h2>

<div class="info"><b>Current WiFi</b><span>)rawliteral";
    html += currentSSID;
    html += R"rawliteral(</span></div>

<form action="/wifi/save" method="POST">

<label>Available Networks</label>
<div class="field-row">
<select name="wifi_ssid">)rawliteral";
    html += networkOptions;
    html += R"rawliteral(
</select>
<button type="button" class="btn-sm ghost" onclick="refreshNetworks()">⟳ Refresh</button>
</div>

<label>Password</label>
<div class="pw-wrap">
<input type="password" name="wifi_password" id="wifiPassword" placeholder="WiFi password" required>
<button type="button" class="pw-toggle" id="pwToggle" aria-label="Show password">👁</button>
</div>
<p class="hint">Save hone ke baad device naye network se connect hone ke liye restart hogi.</p>

<hr style="border:0;border-top:1px solid rgba(255,255,255,.08);margin:18px 0">
<h2>Access Point (Hotspot)</h2>
<p class="hint">Isi naam/password se device ka hotspot (192.168.4.1) connect hota hai — yahan se kabhi bhi change kar sakte ho. Factory reset pe serial-derived naam/password wapas aa jayega.</p>

<label>Hotspot Name (AP SSID)</label>
<input type="text" name="ap_name" maxlength="32" value=")rawliteral";
    html += currentAPName;
    html += R"rawliteral(" placeholder="SwitchNest-<serial>">

<label>Hotspot Password</label>
<div class="pw-wrap">
<input type="password" name="ap_password" id="apPassword" maxlength="32" value=")rawliteral";
    html += currentAPPassword;
    html += R"rawliteral(" placeholder="serial key">
<button type="button" class="pw-toggle" id="apPwToggle" aria-label="Show password">👁</button>
</div>
<p class="hint">Khali chhodo to serial-derived default use hoga (SwitchNest-&lt;serial&gt; / serial key).</p>

<button type="submit">Save &amp; Connect</button>

</form>
</div>

<script>
async function refreshNetworks()
{
    var sel = document.querySelector("select[name='wifi_ssid']");
    sel.innerHTML = "<option>Scanning...</option>";
    try {
        var r = await fetch("/wifi/scan");
        var list = await r.json();
        sel.innerHTML = "";
        if(list.length == 0) {
            sel.innerHTML = "<option value=''>No Networks Found</option>";
            return;
        }
        list.forEach(function(n){
            var o = document.createElement("option");
            o.value = n.ssid;
            o.textContent = "📶 " + n.ssid + " (" + n.rssi + " dBm)";
            sel.appendChild(o);
        });
    } catch(e) {
        sel.innerHTML = "<option value=''>Scan Failed</option>";
    }
}

document.getElementById("pwToggle").addEventListener("click", function(){
    var inp = document.getElementById("wifiPassword");
    inp.type = (inp.type === "password") ? "text" : "password";
    this.textContent = (inp.type === "password") ? "👁" : "🙈";
});

document.getElementById("apPwToggle").addEventListener("click", function(){
    var inp = document.getElementById("apPassword");
    inp.type = (inp.type === "password") ? "text" : "password";
    this.textContent = (inp.type === "password") ? "👁" : "🙈";
});
</script>
)rawliteral";

    html += uiEnd();

    return html;
}
