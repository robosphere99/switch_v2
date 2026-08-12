#include "web/UIResources.h"

// ==================================================
// Robosphere IoT - UI Design System
// Glassmorphism + Light/Dark themes + Responsive
// ==================================================
const char *STYLE_CSS = R"rawliteral(
/* ---------- Theme Variables ---------- */
:root {
  --text: #1e293b;
  --text-dim: #64748b;

  /* Professional palette */
  --primary: #2563EB;
  --secondary: #7C3AED;
  --tertiary: #0EA5E9;

  /* Aliases (backwards compatible) */
  --accent: var(--primary);
  --accent2: var(--secondary);

  --success: #22c55e;
  --danger: #ef4444;
  --warn: #f59e0b;
  --glass-bg: rgba(255,255,255,0.55);
  --glass-border: rgba(255,255,255,0.75);
  --glass-shadow: 0 8px 32px rgba(31,38,135,0.15);
  --input-bg: rgba(255,255,255,0.7);
  --input-border: rgba(100,116,139,0.25);
  --row-bg: rgba(255,255,255,0.45);
  --nav-bg: rgba(255,255,255,0.6);
  --bg-gradient: linear-gradient(135deg,#e0e7ff 0%,#f4f8ff 45%,#ffe4e6 100%);
  --blob1: rgba(99,102,241,0.35);
  --blob2: rgba(34,211,238,0.3);
  --blob3: rgba(244,114,182,0.3);
  --shadow: 0 4px 20px rgba(15,23,42,0.08);
}

[data-theme="dark"] {
  --text: #e2e8f0;
  --text-dim: #94a3b8;

  /* Professional palette (brighter for dark bg) */
  --primary: #3B82F6;
  --secondary: #8B5CF6;
  --tertiary: #38BDF8;

  --accent: var(--primary);
  --accent2: var(--secondary);

  --glass-bg: rgba(30,41,59,0.55);
  --glass-border: rgba(255,255,255,0.12);
  --glass-shadow: 0 8px 32px rgba(0,0,0,0.45);
  --input-bg: rgba(15,23,42,0.6);
  --input-border: rgba(148,163,184,0.25);
  --row-bg: rgba(255,255,255,0.06);
  --nav-bg: rgba(15,23,42,0.6);
  --bg-gradient: linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#31103a 100%);
  --blob1: rgba(99,102,241,0.25);
  --blob2: rgba(34,211,238,0.16);
  --blob3: rgba(244,114,182,0.2);
  --shadow: 0 4px 20px rgba(0,0,0,0.4);
}

/* ---------- Base ---------- */
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Segoe UI', system-ui, -apple-system, Arial, sans-serif;
  color: var(--text);
  background: var(--bg-gradient);
  background-attachment: fixed;
  min-height: 100vh;
  transition: background .4s, color .4s;
  overflow-x: hidden;
}

/* Glassmorphism background blobs */
body::before, body::after {
  content: '';
  position: fixed;
  border-radius: 50%;
  filter: blur(90px);
  z-index: -1;
  transition: background .4s;
}
body::before {
  width: 440px; height: 440px;
  top: -140px; left: -140px;
  background: var(--blob1);
  animation: float1 18s ease-in-out infinite;
}
body::after {
  width: 500px; height: 500px;
  bottom: -160px; right: -140px;
  background: var(--blob3);
  animation: float2 22s ease-in-out infinite;
}
@keyframes float1 { 50% { transform: translate(60px,40px) scale(1.1); } }
@keyframes float2 { 50% { transform: translate(-50px,-30px) scale(1.15); } }

/* ---------- Glass Card ---------- */
.card, .glass {
  background: var(--glass-bg);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid var(--glass-border);
  border-radius: 18px;
  box-shadow: var(--glass-shadow);
  max-width: 560px;
  margin: 24px auto;
  padding: 22px;
  transition: background .4s, border .4s;
}
.card.wide { max-width: 720px; }

h1, h2, h3 { color: var(--text); }
h2 { margin-bottom: 16px; }
p { color: var(--text-dim); line-height: 1.5; }
hr { border: none; height: 1px; background: var(--input-border); margin: 18px 0; }
a { color: var(--accent); }

/* ---------- Navbar ---------- */
.navbar {
  position: sticky;
  top: 12px;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 900px;
  margin: 12px auto 0;
  padding: 10px 16px;
}
.brand {
  font-weight: 800;
  font-size: 18px;
  color: var(--text);
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.nav-links {
  display: flex;
  gap: 4px;
  flex: 1;
  flex-wrap: wrap;
}
.nav-links a {
  color: var(--text-dim);
  text-decoration: none;
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  transition: .25s;
}
.nav-links a:hover { color: var(--text); background: var(--row-bg); }
.nav-links a.active {
  color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  box-shadow: 0 4px 14px rgba(37,99,235,.35);
}
.nav-toggle {
  display: none;
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text);
  width: auto;
  margin: 0;
  padding: 4px 10px;
  box-shadow: none;
}
.theme-toggle {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  color: var(--text);
  font-size: 18px;
  cursor: pointer;
  transition: .3s;
  box-shadow: var(--shadow);
  margin: 0;
  padding: 0;
}
.theme-toggle:hover { transform: scale(1.1) rotate(15deg); box-shadow: var(--glass-shadow); }
.theme-toggle.floating {
  position: fixed;
  top: 18px;
  right: 18px;
  z-index: 200;
  width: 46px;
  height: 46px;
}

/* ---------- Layout ---------- */
.container {
  max-width: 900px;
  margin: 0 auto;
  padding: 10px 16px 60px;
}
.auth-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.auth-card {
  max-width: 400px;
  width: 100%;
  padding: 34px 28px;
  text-align: center;
}

/* ---------- Login / Brand ---------- */
.logo {
  width: 74px;
  height: 74px;
  margin: 0 auto 14px;
  border-radius: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 38px;
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  box-shadow: 0 10px 30px rgba(37,99,235,.4);
}
.auth-card h1 { font-size: 26px; margin-bottom: 4px; }
.auth-card .sub { font-size: 14px; margin-bottom: 22px; }

/* ---------- Forms ---------- */
label {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-dim);
  margin: 14px 0 6px;
  text-align: left;
}
input, select {
  width: 100%;
  padding: 12px 14px;
  background: var(--input-bg);
  border: 1.5px solid var(--input-border);
  border-radius: 12px;
  color: var(--text);
  font-size: 15px;
  outline: none;
  transition: border .3s, box-shadow .3s;
}
input:focus, select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(37,99,235,.18);
}

/* ---------- Buttons ---------- */
button {
  padding: 12px 18px;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  box-shadow: 0 4px 14px rgba(37,99,235,.3);
  transition: .3s;
  margin-top: 10px;
  width: 100%;
}
button:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(37,99,235,.4); }
button:disabled { opacity: .5; cursor: not-allowed; transform: none; box-shadow: none; }

.danger, .red { background: linear-gradient(135deg,#ef4444,#dc2626); box-shadow: 0 4px 14px rgba(239,68,68,.3); }
.warn, .orange { background: linear-gradient(135deg,#f59e0b,#ea580c); box-shadow: 0 4px 14px rgba(245,158,11,.3); }
.gray, .ghost { background: linear-gradient(135deg,#64748b,#475569); box-shadow: 0 4px 14px rgba(100,116,139,.25); }
.success { background: linear-gradient(135deg,#22c55e,#16a34a); box-shadow: 0 4px 14px rgba(34,197,94,.3); }

/* ---------- Info Rows ---------- */
.info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 13px 16px;
  margin: 10px 0;
  background: var(--row-bg);
  border-radius: 12px;
  border-left: 4px solid var(--accent);
  font-size: 14px;
}
.info b { color: var(--text); }
.info .notes {
  flex-basis: 100%;
  margin-top: 6px;
  font-size: 13px;
}
.online { color: #16a34a; font-weight: 800; }
.offline { color: #ef4444; font-weight: 800; }

/* ---------- Relay Cards ---------- */
.relay-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 14px;
}
.relay-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border-radius: 14px;
  cursor: pointer;
  background: var(--glass-bg);
  border: 1.5px solid var(--glass-border);
  box-shadow: var(--shadow);
  transition: .25s;
}
.relay-card:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,.12); }
.relay-card.on  { border-color: #22c55e; box-shadow: 0 3px 14px rgba(34,197,94,.25); }
.relay-card.off { opacity: .92; }
.relay-card .r-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.relay-card .r-name { font-weight: 800; font-size: 15px; color: var(--text); }
.relay-card .r-badge {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .5px;
  padding: 3px 10px;
  border-radius: 999px;
  color: #fff;
  white-space: nowrap;
}
.relay-card.on  .r-badge { background: linear-gradient(135deg,#22c55e,#16a34a); }
.relay-card.off .r-badge { background: linear-gradient(135deg,#94a3b8,#64748b); }
.relay-card .r-device {
  font-size: 12px;
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
}
.relay-card .r-device .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.relay-card.on  .r-device .dot { background: #22c55e; box-shadow: 0 0 6px #22c55e; }
.relay-card.off .r-device .dot { background: #94a3b8; }
.relay-card .r-hint { font-size: 10px; color: var(--text-dim); opacity: .75; }

/* ---------- Layout Helpers ---------- */
.btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}
.btn-row button { margin-top: 0; flex: 1 1 auto; }
.btn-sm {
  padding: 10px 14px;
  font-size: 13px;
  width: auto;
  margin: 0;
}
.hint {
  font-size: 12px;
  color: var(--text-dim);
  margin: 6px 2px 0;
  text-align: left;
  line-height: 1.45;
}
.divider-text {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 22px 0 10px;
  color: var(--text-dim);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: .5px;
}
.divider-text::before, .divider-text::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--input-border);
}
.map-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  margin: 8px 0;
  background: var(--row-bg);
  border-radius: 12px;
  border-left: 4px solid var(--tertiary);
}
.map-row .badge {
  flex-shrink: 0;
  min-width: 46px;
  text-align: center;
  font-weight: 800;
  font-size: 13px;
  color: #fff;
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  border-radius: 10px;
  padding: 9px 10px;
  box-shadow: 0 3px 10px rgba(37,99,235,.3);
}

/* AP mode badge — dashboard pe jab device fallback AP mein ho */
.ap-badge {
  color: #f59e0b !important;
  background: rgba(245, 158, 11, .12);
  border: 1px solid rgba(245, 158, 11, .4);
  border-radius: 20px;
  padding: 3px 12px;
  font-size: 12px;
  font-weight: 700;
  display: inline-block;
  animation: apPulse 2.5s ease-in-out infinite;
}
@keyframes apPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: .55; }
}
.map-row select { flex: 1; margin: 0; }
.field-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.field-row select { flex: 1; margin: 0; }
.field-row .btn-sm { margin: 0; flex-shrink: 0; }
.file-box {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 14px;
  margin: 10px 0;
  background: var(--row-bg);
  border: 1.5px dashed var(--input-border);
  border-radius: 12px;
  cursor: pointer;
  transition: .3s;
}
.file-box:hover { border-color: var(--accent); background: var(--glass-bg); }
.file-box input[type="file"] { display: none; }
.file-box .file-name {
  font-size: 13px;
  color: var(--text-dim);
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pw-wrap { position: relative; }
.pw-wrap input { padding-right: 48px; }
.pw-toggle {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  margin: 0;
  padding: 0;
  border-radius: 10px;
  background: var(--row-bg);
  border: none;
  box-shadow: none;
  color: var(--text-dim);
  font-size: 15px;
}
.pw-toggle:hover { color: var(--text); box-shadow: none; transform: translateY(-50%) scale(1.05); }
.msg-card { text-align: center; padding: 32px 24px; }
.msg-card .msg-icon { font-size: 42px; margin-bottom: 12px; }
.msg-card h2 { margin-bottom: 8px; }
.msg-card .msg-sub { font-size: 14px; margin-bottom: 20px; }
.msg-card.ok  { border: 1.5px solid rgba(34,197,94,.45); }
.msg-card.err { border: 1.5px solid rgba(239,68,68,.45); }
.zone-danger {
  border: 1.5px solid rgba(239,68,68,.35);
  background: rgba(239,68,68,.06);
  border-radius: 14px;
  padding: 14px 16px;
  margin-top: 14px;
}
.zone-danger h3 { color: #ef4444; margin-bottom: 4px; }
.zone-danger .hint { margin-top: 4px; }

/* ---------- Misc ---------- */
.sectionTitle { margin-top: 26px; margin-bottom: 10px; font-size: 17px; font-weight: 800; color: var(--tertiary); }
.notes {
  background: var(--row-bg);
  padding: 10px;
  border-radius: 10px;
  white-space: pre-line;
  color: var(--text-dim);
  font-size: 13px;
}
progress {
  width: 100%;
  height: 14px;
  border: none;
  border-radius: 8px;
  overflow: hidden;
  margin-top: 8px;
}
progress::-webkit-progress-bar { background: var(--row-bg); border-radius: 8px; }
progress::-webkit-progress-value { background: linear-gradient(135deg,var(--accent),var(--tertiary)); border-radius: 8px; }

/* ---------- Responsive ---------- */
@media (max-width: 640px) {
  .nav-toggle { display: block; }
  .nav-links {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    flex-direction: column;
    padding: 10px;
    background: var(--nav-bg);
    backdrop-filter: blur(18px);
    border: 1px solid var(--glass-border);
    border-radius: 0 0 18px 18px;
    box-shadow: var(--glass-shadow);
  }
  .nav-links.open { display: flex; }
  .card { margin: 16px 12px; padding: 18px; }
  .relay-grid { grid-template-columns: 1fr; }
}
)rawliteral";

// ==================================================
// Theme system + mobile navigation
// ==================================================
const char *APP_JS = R"rawliteral(
(function () {
  var KEY = "robosphere-theme";

  function getTheme() {
    try { return localStorage.getItem(KEY) || "light"; } catch (e) { return "light"; }
  }

  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    var btn = document.getElementById("themeToggle");
    if (btn) btn.textContent = (t === "dark") ? "☀️" : "🌙";
  }

  function toggleTheme() {
    var t = (getTheme() === "dark") ? "light" : "dark";
    try { localStorage.setItem(KEY, t); } catch (e) {}
    applyTheme(t);
  }

  // Apply before paint — no theme flash
  applyTheme(getTheme());

  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.getElementById("themeToggle");
    if (btn) btn.addEventListener("click", toggleTheme);

    var navToggle = document.getElementById("navToggle");
    var navLinks = document.getElementById("navLinks");

    if (navToggle && navLinks) {
      navToggle.addEventListener("click", function () {
        navLinks.classList.toggle("open");
      });
    }
  });
})();
)rawliteral";
