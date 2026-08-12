#include "web/ServerPage.h"
#include "web/UI.h"

String ServerPage(
    const String &serverURL,
    const String &apiKey)
{
    String html;

    html += uiHead("Server Settings");

    html += uiNav("/server");

    html += R"rawliteral(
<div class="card">
<h2>Server Settings</h2>
<p class="hint">Robosphere ka backend server — yahan se devices sync hoti hain aur relay states push hoti hain. Pehle Test Connection se check karo, phir Save karo.</p>

<form action="/server/save" method="POST">

<label>Server URL</label>
<input type="text" name="server_url" value=")rawliteral";
    html += serverURL;
    html += R"rawliteral(" placeholder="https://your-server.com/api/">
<p class="hint">Example: https://robosphere.bhartitechnical.com/api/</p>

<label>API Key</label>
<input type="text" name="api_key" value=")rawliteral";
    html += apiKey;
    html += R"rawliteral(" placeholder="API key">

<div class="btn-row">
<button type="submit">💾 Save Settings</button>
<button type="button" class="ghost" onclick="testServer()">🔌 Test Connection</button>
<button type="button" class="ghost" onclick="downloadDevices()">📥 Download Devices</button>
</div>

</form>

<div id="result"></div>
</div>

<script>
function showResult(msg, ok)
{
    var box = document.getElementById("result");
    box.innerHTML = "<div class='notes' style='border-left:4px solid " + (ok ? "#22c55e" : "#ef4444") + "'>" + msg + "</div>";
}

async function testServer()
{
    showResult("Testing connection...", true);
    try {
        var r = await fetch("/server/test");
        var d = await r.json();
        showResult((d.success ? "✅ " : "❌ ") + d.message + (d.success && d.count !== undefined ? " — " + d.count + " devices" : ""), d.success);
    } catch(e) {
        showResult("❌ Request failed", false);
    }
}

async function downloadDevices()
{
    showResult("Downloading devices...", true);
    try {
        var r = await fetch("/server/download");
        var d = await r.json();
        showResult((d.success ? "✅ " : "❌ ") + d.message + (d.success ? " — " + d.count + " devices" : ""), d.success);
    } catch(e) {
        showResult("❌ Request failed", false);
    }
}
</script>
)rawliteral";

    html += uiEnd();

    return html;
}
