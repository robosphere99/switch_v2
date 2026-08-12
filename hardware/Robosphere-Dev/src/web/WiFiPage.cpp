#include "web/WiFiPage.h"
#include "web/UI.h"

String WiFiPage(
    const String &currentSSID,
    const String &networkOptions)
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
</script>
)rawliteral";

    html += uiEnd();

    return html;
}
