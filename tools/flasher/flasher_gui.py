#!/usr/bin/env python3
"""
RoboSphere Factory Flasher — manufacturing tool
================================================
Flash ESP32 relay boards and provision them for a specific order:

  1. Login to the RoboSphere admin API
  2. Fetch an order (auto-fills serial code, model, WiFi, API key)
  3. Flash the published firmware (.bin from /firmware/firmware.bin)
  4. Provision via serial: WiFi + server URL + API key + serial code + model
  5. Relay self-test (each channel cycles on/off, reports OK/FAIL)
  6. Web server reach check (reboot ke baad AP/LAN IP pe HTTP-ping)
  7. Mark serial as factory-tested on the server
  8. Next board (batch mode)

Requirements:  pip install requests pyserial esptool

Run:           python flasher_gui.py
Dep check:     python flasher_gui.py --check   (GUI ke bina deps verify)
"""

import io
import json
import os
import queue
import re
import sys
import threading
import time
import tkinter as tk
import urllib.error
import urllib.request
import webbrowser
from tkinter import messagebox, scrolledtext, ttk

# Soft imports — missing dep ho to GUI crash na ho, friendly message dikhao.
try:
    import requests
except ImportError:
    requests = None

try:
    import serial  # pyserial
except ImportError:
    serial = None

MODELS = ["2CH", "4CH", "5CH", "6CH", "8CH", "4CH-IR", "FAN-DIM", "DIM-3S", "DIM-4S"]
BAUD = 115200
FLASH_ADDR = "0x10000"  # ESP32 app partition (standard PlatformIO layout)

# Boot log me firmware inhe print karta hai (WiFiManager.cpp):
#   AP IP : 192.168.4.1   (dual-mode AP — WiFi connect hone ke baad bhi ON)
#   IP : 192.168.1.36     (LAN IP, jab board WiFi se connect hota hai)
BOOT_IP_RE = re.compile(r"(?:AP IP|IP)\s*:\s*(\d{1,3}(?:\.\d{1,3}){3})")

# Server mode presets — (label, API URL, web URL). Localhost testing se live
# site pe switch karte waqt URL bhoolna band — ek click me dono set.
SERVER_PRESETS = [
    ("Live site", "https://onlineswitch.bhartitechnical.com", "https://onlineswitch.bhartitechnical.com"),
    ("Localhost", "http://localhost:4000", "http://localhost:5173"),
]

INSTALL_CMD = "pip install requests pyserial esptool"

APP_VERSION = "1.1"


def check_deps():
    """Startup dep auto-check — missing pip packages ki list return karta hai.

    Fresh environment me bina crash ke chalta hai: jo dep nahi hai wo sirf
    report hota hai, app phir bhi khulta hai (disabled features ke saath).
    """
    missing = []
    if requests is None:
        missing.append("requests")
    if serial is None:
        missing.append("pyserial")
    try:
        import esptool  # noqa: F401
    except ImportError:
        missing.append("esptool")
    return missing


def find_com_ports():
    if serial is None:
        return []
    try:
        from serial.tools import list_ports
        return [p.device for p in list_ports.comports()]
    except Exception:
        return []


def detect_lan_ip():
    """Machine ka LAN IP — ESP server URL default ke liye (boards isi IP pe
    heartbeat bhejte hain). No actual traffic — sirf route lookup.

    Multiple gateway candidates try karte hain (router ka IP pehle se pata
    nahi hota — 192.168.1.x / 192.168.0.x / 10.x / 172.16.x sab ho sakte hain),
    phir hostname resolution, phir hardcoded fallback."""
    import socket
    candidates = ["192.168.1.1", "192.168.0.1", "10.0.0.1", "172.16.0.1", "8.8.8.8"]
    for target in candidates:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.settimeout(1)
            s.connect((target, 80))
            ip = s.getsockname()[0]
            s.close()
            if ip and not ip.startswith("127."):
                return ip
        except Exception:
            continue
    # Fallback — hostname resolution se pehla non-loopback IPv4
    try:
        for ip in socket.gethostbyname_ex(socket.gethostname())[2]:
            if ip and not ip.startswith("127."):
                return ip
    except Exception:
        pass
    return "192.168.1.100"


class FlasherApp:
    BOOT_IP_RE = re.compile(r"(?:AP IP|IP)\s*:\s*(\d{1,3}(?:\.\d{1,3}){3})")

    def __init__(self, root: tk.Tk):
        self.root = root
        root.title(f"RoboSphere Factory Flasher v{APP_VERSION}")
        # Screen ke hisaab se default size (chhote laptop pe bhi sab dikhe)
        sw, sh = root.winfo_screenwidth(), root.winfo_screenheight()
        root.geometry(f"{min(1180, sw - 40)}x{min(800, sh - 100)}")
        root.minsize(980, 640)
        root.configure(bg="#0d1117")

        self.token = None
        self.ser = None
        self.busy = False
        self.log_q = queue.Queue()
        self.order_items = []  # pending batch queue (quantity expanded — 1 entry = 1 board)
        self.cur_serial = ""
        self.cur_order_id = None     # loaded order ka numeric id
        self.cur_order_no = ""       # display ke liye
        self.provision_data = {}     # fetched order ka data (WiFi + apiKey)
        self.generated_serials = []  # is order me pehle se generate serials
        self.order_models = []       # fetched order ke available models (dropdown sirf yehi dikhaye)
        self.board_index = 0         # order me kaunsa board (hotspot naam ka _N suffix)
        self.monitor_on = False      # serial monitor inline toggle (on/off)
        self.mon_ser = None          # monitor ke liye serial connection
        self.mon_stop = None         # threading.Event — reader stop ke liye
        self.mon_q = None            # queue.Queue — serial chunks

        # Startup dep auto-check — UI se pehle taaki banner bana sake
        self.missing_deps = check_deps()

        self._build_ui()
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)
        self._log("RoboSphere Factory Flasher ready.")
        if self.missing_deps:
            self._log(
                f"[WARN] Missing dependencies: {', '.join(self.missing_deps)} — "
                f"kuch features disabled. Install: {INSTALL_CMD}",
                "warn",
            )
            self._log("       (ya upar 'Install now' button dabao)", "warn")
        else:
            self._log("Dependencies OK (requests, pyserial, esptool)", "ok")
        self.root.after(100, self._drain_log)

    # ---------------- UI ----------------

    def _build_ui(self):
        # ---- Dark theme (clam — full color control) ----
        BG, PANEL, BORDER = "#0d1117", "#161b22", "#30363d"
        FG, MUT, BLUE, GREEN = "#e6edf3", "#8b949e", "#1f6feb", "#238636"
        style = ttk.Style()
        style.theme_use("clam")
        style.configure(".", background=BG, foreground=FG, fieldbackground=PANEL,
                        bordercolor=BORDER, lightcolor=BORDER, darkcolor=BORDER,
                        focuscolor=BLUE)
        style.configure("TFrame", background=BG)
        style.configure("TLabel", background=BG, foreground=FG)
        style.configure("Muted.TLabel", background=BG, foreground=MUT)
        style.configure("TLabelframe", background=BG, foreground=FG, bordercolor=BORDER,
                        lightcolor=BORDER, darkcolor=BORDER)
        style.configure("TLabelframe.Label", background=BG, foreground=BLUE,
                        font=("Segoe UI", 10, "bold"))
        style.configure("TEntry", fieldbackground="#010409", foreground=FG, insertcolor=FG,
                        bordercolor=BORDER, padding=5)
        style.configure("TCombobox", fieldbackground="#010409", foreground=FG, background=PANEL,
                        arrowcolor=FG, bordercolor=BORDER, padding=5)
        style.map("TCombobox", fieldbackground=[("readonly", "#010409")],
                  foreground=[("readonly", FG)], background=[("readonly", PANEL)])
        style.configure("TButton", background=PANEL, foreground=FG, bordercolor=BORDER,
                        padding=(12, 6))
        style.map("TButton", background=[("active", BLUE), ("disabled", "#21262d")],
                  foreground=[("disabled", MUT)])
        style.configure("Primary.TButton", background=GREEN, foreground="#ffffff",
                        padding=(14, 7), font=("Segoe UI", 9, "bold"))
        style.map("Primary.TButton", background=[("active", "#2ea043"), ("disabled", "#21262d")])

        pad = {"padx": 6, "pady": 4}

        # Row 0 — deps warning banner (sirf missing pe dikhta hai, fresh env friendly)
        if self.missing_deps:
            warn = ttk.Frame(self.root, padding=(10, 6))
            warn.grid(row=0, column=0, sticky="ew")
            warn.columnconfigure(1, weight=1)
            ttk.Label(warn, text="⚠️ Missing dependencies: " + ", ".join(self.missing_deps),
                      foreground="#d29922", font=("Segoe UI", 9, "bold"))\
                .grid(row=0, column=0, sticky="w")
            ttk.Label(warn, text="Kuch features disabled — " + INSTALL_CMD,
                      style="Muted.TLabel").grid(row=0, column=1, sticky="w", padx=10)
            self.b_install = ttk.Button(warn, text="Install now", command=self.do_install_deps)
            self.b_install.grid(row=0, column=2, padx=6)

        f = ttk.Frame(self.root, padding=10)
        f.grid(row=1, column=0, sticky="nsew")
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(1, weight=1)
        f.columnconfigure(0, weight=1)

        # Row 1 — connection
        row = ttk.LabelFrame(f, text=" 1 · Server Connection ", padding=8)
        row.grid(row=0, column=0, sticky="ew", **pad)
        row.columnconfigure(1, weight=3)
        row.columnconfigure(3, weight=1)
        row.columnconfigure(5, weight=1)
        # Row 0 — original layout (cramped nahi): Site URL + creds + Login
        ttk.Label(row, text="Site URL").grid(row=0, column=0, sticky="w")
        self.e_server = ttk.Entry(row, width=30)
        self.e_server.insert(0, "https://onlineswitch.bhartitechnical.com")
        self.e_server.grid(row=0, column=1, padx=4)
        ttk.Label(row, text="Admin user").grid(row=0, column=2, sticky="w")
        self.e_user = ttk.Entry(row, width=12)
        self.e_user.insert(0, "admin")
        self.e_user.grid(row=0, column=3, padx=4)
        ttk.Label(row, text="Password").grid(row=0, column=4, sticky="w")
        self.e_pass = ttk.Entry(row, width=12, show="*")
        self.e_pass.grid(row=0, column=5, padx=4)
        self.b_login = ttk.Button(row, text="Login", style="Primary.TButton", command=self.do_login)
        self.b_login.grid(row=0, column=6, padx=4)
        self.l_login = ttk.Label(row, text="Not logged in", foreground="orange")
        self.l_login.grid(row=0, column=7, padx=8)
        # Row 1 — Mode selector + Guide button (mode ke BAGAL me) + ESP server URL
        ttk.Label(row, text="Mode").grid(row=1, column=0, sticky="w", pady=(6, 0))
        self.cb_mode = ttk.Combobox(row, width=10, state="readonly",
                                    values=[p[0] for p in SERVER_PRESETS])
        self.cb_mode.set("Live site")
        self.cb_mode.grid(row=1, column=1, padx=4, pady=(6, 0), sticky="w")
        self.cb_mode.bind("<<ComboboxSelected>>", self.on_server_mode)
        ttk.Button(row, text="Guide", command=self.open_guide)\
            .grid(row=1, column=2, padx=(8, 4), pady=(6, 0))
        ttk.Label(row, text="ESP Server URL (board ko dikhe)")\
            .grid(row=1, column=3, sticky="w", pady=(6, 0))
        self.lan_ip = detect_lan_ip()
        self.e_esp_server = ttk.Entry(row, width=30)
        self.e_esp_server.insert(0, f"http://{self.lan_ip}:4000")
        self.e_esp_server.grid(row=1, column=4, padx=4, pady=(6, 0))
        ttk.Button(row, text="⟳", width=3, command=self.refresh_lan_ip)\
            .grid(row=1, column=5, padx=(4, 0), pady=(6, 0))
        # Detected LAN IP — Localhost mode me boards isi IP pe heartbeat bhejte
        # hain; WiFi change / IP renew pe ⟳ se dobara detect karo.
        self.l_esp_hint = ttk.Label(
            row,
            text=f"Detected LAN IP: {self.lan_ip} — boards isi pe connect honge",
            foreground="#9ca3af",
        )
        self.l_esp_hint.grid(row=2, column=3, columnspan=3, sticky="w", pady=(2, 0))

        # Row 2 — order + device (wide fields — lamba order number ab pura dikhta hai)
        row = ttk.LabelFrame(f, text=" 2 · Order / Device ", padding=10)
        row.grid(row=1, column=0, sticky="ew", **pad)
        row.columnconfigure(1, weight=2)
        row.columnconfigure(5, weight=2)

        ttk.Label(row, text="Order #").grid(row=0, column=0, sticky="w", pady=2)
        self.e_order = ttk.Entry(row, width=28)
        self.e_order.grid(row=0, column=1, padx=4, pady=2, sticky="ew")
        self.b_fetch = ttk.Button(row, text="Fetch Order", command=self.do_fetch)
        self.b_fetch.grid(row=0, column=2, padx=4, pady=2)
        self.l_orderinfo = ttk.Label(row, text="", foreground="#7ee787")
        self.l_orderinfo.grid(row=0, column=3, columnspan=4, padx=8, sticky="w")

        # Layout: Model LEFT, Serial + Generate RIGHT (order ke devices ke hisaab se)
        ttk.Label(row, text="Model").grid(row=1, column=0, sticky="w", pady=2)
        self.cb_model = ttk.Combobox(row, values=MODELS, width=8, state="readonly")
        self.cb_model.set("4CH")
        self.cb_model.grid(row=1, column=1, padx=4, pady=2)
        ttk.Label(row, text="Serial code").grid(row=1, column=2, sticky="w", pady=2, padx=(12, 0))
        self.e_serial = ttk.Entry(row, width=22)
        self.e_serial.grid(row=1, column=3, padx=4, pady=2, sticky="ew")
        self.b_gen = ttk.Button(row, text="Generate", command=self.gen_serial)
        self.b_gen.grid(row=1, column=4, padx=4, pady=2)

        ttk.Label(row, text="WiFi SSID").grid(row=2, column=0, sticky="w", pady=2)
        self.e_ssid = ttk.Entry(row, width=16)
        self.e_ssid.grid(row=2, column=1, padx=4, pady=2, sticky="ew")
        ttk.Label(row, text="WiFi pass").grid(row=2, column=2, sticky="w", pady=2)
        self.e_wpass = ttk.Entry(row, width=16)
        self.e_wpass.grid(row=2, column=3, padx=4, pady=2)
        ttk.Label(row, text="API key").grid(row=2, column=4, sticky="w", pady=2)
        self.e_apikey = ttk.Entry(row, width=26)
        self.e_apikey.grid(row=2, column=5, columnspan=2, padx=4, pady=2, sticky="ew")
        self.l_item = ttk.Label(row, text="", foreground="#7ee787")
        self.l_item.grid(row=2, column=6, padx=4, pady=2)

        # Row 3 — port + actions
        row = ttk.LabelFrame(f, text=" 3 · Flash & Provision ", padding=8)
        row.grid(row=2, column=0, sticky="ew", **pad)
        ttk.Label(row, text="COM port").grid(row=0, column=0, sticky="w")
        self.cb_port = ttk.Combobox(row, width=12)
        self.refresh_ports()
        self.cb_port.grid(row=0, column=1, padx=4)
        self.b_refresh = ttk.Button(row, text="⟳", width=3, command=self.refresh_ports)
        self.b_refresh.grid(row=0, column=2, padx=2)

        self.b_flash = ttk.Button(row, text="1 · Flash Firmware", command=self.do_flash)
        self.b_flash.grid(row=0, column=3, padx=6)
        self.b_prov = ttk.Button(row, text="2 · Provision + Test", command=self.do_provision)
        self.b_prov.grid(row=0, column=4, padx=6)
        self.b_mark = ttk.Button(row, text="3 · Mark Tested", command=self.do_mark)
        self.b_mark.grid(row=0, column=5, padx=6)
        self.b_monitor = ttk.Button(row, text="🔍 Serial Monitor", command=self.toggle_monitor)
        self.b_monitor.grid(row=0, column=6, padx=6)
        self.b_next = ttk.Button(row, text="Next Board ▸", command=self.do_next)
        self.b_next.grid(row=0, column=7, padx=6)
        self.l_prog = ttk.Label(row, text="Idle", foreground="orange")
        self.l_prog.grid(row=0, column=8, padx=8)

        # Row 3b — serial monitor (inline, toggle se show/hide — alag window nahi)
        self.mon_frame = ttk.LabelFrame(f, text=" Serial Monitor ", padding=8)
        self.mon_out = scrolledtext.ScrolledText(self.mon_frame, height=8, bg="#010409", fg="#e6edf3",
                                                 insertbackground="#e6edf3", relief="flat",
                                                 font=("Consolas", 10))
        self.mon_out.pack(fill="both", expand=True)
        self.mon_out.tag_configure("ok", foreground="#7ee787")
        self.mon_out.tag_configure("err", foreground="#ff7b72")
        mbar = ttk.Frame(self.mon_frame)
        mbar.pack(fill="x", pady=(6, 0))
        self.l_mon_state = ttk.Label(mbar, text="", style="Muted.TLabel")
        self.l_mon_state.pack(side="left")
        self.mon_cmd = ttk.Entry(mbar)
        self.mon_cmd.pack(side="left", fill="x", expand=True, padx=8)
        self.mon_cmd.bind("<Return>", lambda e: self.mon_send())
        ttk.Button(mbar, text="Send", command=self.mon_send).pack(side="left", padx=2)
        ttk.Button(mbar, text="Clear", command=self.mon_clear).pack(side="left", padx=2)
        self.mon_frame.grid(row=3, column=0, sticky="nsew", **pad)
        self.mon_frame.grid_remove()

        # Row 4 — log (resize pe expand)
        row = ttk.LabelFrame(f, text=" Log ", padding=8)
        row.grid(row=4, column=0, sticky="nsew", **pad)
        f.rowconfigure(4, weight=1)
        self.log = scrolledtext.ScrolledText(row, height=12, bg="#010409", fg="#e6edf3",
                                             insertbackground="#e6edf3", relief="flat",
                                             font=("Consolas", 10))
        self.log.pack(fill="both", expand=True)
        self.log.tag_configure("ok", foreground="#7ee787")
        self.log.tag_configure("err", foreground="#ff7b72")
        self.log.tag_configure("warn", foreground="#d29922")
        self.log.tag_configure("info", foreground="#58a6ff")

        ttk.Label(f, text="Flow: 1) Flash  →  2) Provision + Relay test  →  3) Mark tested  →  Next board",
                  style="Muted.TLabel").grid(row=5, column=0, sticky="w", padx=8, pady=(0, 2))

    # ---------------- helpers ----------------

    def _log(self, msg, tag=None):
        ts = time.strftime("%H:%M:%S")
        line = f"[{ts}] {msg}\n"
        self.log_q.put((line, tag))

    def _drain_log(self):
        try:
            while True:
                line, tag = self.log_q.get_nowait()
                self.log.insert("end", line, tag or ())
                self.log.see("end")
        except queue.Empty:
            pass
        self.root.after(100, self._drain_log)

    def set_busy(self, busy: bool):
        self.busy = busy
        self.l_prog.config(text="Busy…" if busy else "Idle", foreground="orange" if busy else "#7ee787")
        for b in (self.b_flash, self.b_prov, self.b_mark, self.b_next, self.b_monitor,
                  self.b_fetch, self.b_login):
            b.config(state="disabled" if busy else "normal")

    def refresh_ports(self):
        ports = find_com_ports()
        self.cb_port["values"] = ports
        if ports and not self.cb_port.get():
            self.cb_port.set(ports[0])
        self._log(f"Ports: {', '.join(ports) if ports else 'none found'}")

    def api(self, method, path, **kw):
        if requests is None:
            raise RuntimeError(f"requests not installed — {INSTALL_CMD}")
        if not self.token:
            raise RuntimeError("Not logged in")
        kw.setdefault("headers", {})["Authorization"] = f"Bearer {self.token}"
        r = requests.request(method, self.e_server.get().rstrip("/") + path, timeout=15, **kw)
        try:
            body = r.json()
        except Exception:
            body = {}
        if r.status_code >= 400 or not body.get("success"):
            msg = (body.get("error") or {}).get("message") or f"HTTP {r.status_code}"
            raise RuntimeError(msg)
        return body.get("data")

    # ---------------- actions ----------------

    def on_server_mode(self, _event=None):
        """Mode switch — Live site ↔ Localhost. Site URL + ESP server URL
        preset se fill hote hain (dono editable rehte hain — manual bhi kar sakte ho)."""
        label = self.cb_mode.get()
        preset = next((p for p in SERVER_PRESETS if p[0] == label), None)
        if not preset:
            return
        _, api_url, web_url = preset
        self.e_server.delete(0, "end")
        self.e_server.insert(0, api_url)
        if label == "Localhost":
            esp = f"http://{detect_lan_ip()}:4000"
        else:
            esp = api_url  # live pe board seedha site se heartbeat karega
        self.e_esp_server.delete(0, "end")
        self.e_esp_server.insert(0, esp)
        self.l_esp_hint.config(
            text=f"Detected LAN IP: {self.lan_ip} — boards isi pe connect honge",
        )
        self._log(f"Mode: {label} — API {api_url} · ESP server {esp}", "info")
        self._log(f"Guide: {web_url}/admin/flasher-guide (📖 Guide se kholega)", "info")

    def refresh_lan_ip(self):
        """LAN IP dobara detect karo (WiFi change / IP renew hone pe) — ESP
        server field + hint update, sirf Localhost mode me (live pe field
        manual hai)."""
        self.lan_ip = detect_lan_ip()
        self.l_esp_hint.config(
            text=f"Detected LAN IP: {self.lan_ip} — boards isi pe connect honge",
        )
        if self.cb_mode.get() == "Localhost":
            self.e_esp_server.delete(0, "end")
            self.e_esp_server.insert(0, f"http://{self.lan_ip}:4000")
        self._log(f"LAN IP detect: {self.lan_ip}", "info")

    def open_guide(self):
        """Admin ke Flasher Guide page ko browser me kholo — kya bharna hai
        field-by-field (current mode ke hisaab se web URL)."""
        server = self.e_server.get().strip().rstrip("/")
        if "localhost" in server or "127.0.0.1" in server:
            web = "http://localhost:5173"
        else:
            web = server
        url = f"{web}/admin/flasher-guide"
        try:
            webbrowser.open(url)
            self._log(f"Guide khola: {url}", "ok")
        except Exception as e:
            self._log(f"Guide open FAIL: {e} — browser me khud kholo: {url}", "err")

    def do_install_deps(self):
        """Missing deps ko pip se install karo (background) — fresh env me bhi bina crash ke."""
        if self.busy:
            return
        self.busy = True
        self._log(f"Installing: {INSTALL_CMD} …", "info")
        def work():
            try:
                import subprocess
                p = subprocess.run(
                    [sys.executable, "-m", "pip", "install", "--quiet",
                     "requests", "pyserial", "esptool"],
                    capture_output=True, text=True, timeout=300,
                )
                if p.returncode == 0:
                    self._log("Install OK — naye deps load karne ke liye app restart karo.", "ok")
                else:
                    tail = (p.stderr or "").strip().splitlines()[-3:]
                    self._log("Install FAIL: " + (" | ".join(tail) or "pip error"), "err")
            except Exception as e:
                self._log(f"Install error: {e}", "err")
            finally:
                self.root.after(0, lambda: setattr(self, "busy", False))
        threading.Thread(target=work, daemon=True).start()

    def do_login(self):
        if self.busy:
            return
        if requests is None:
            messagebox.showerror("requests missing", f"Login ke liye requests chahiye.\n\nInstall: {INSTALL_CMD}")
            return
        url = self.e_server.get().rstrip("/")
        self.set_busy(True)
        # Browser jaisa UA — kuch hosting/WAF non-browser POST block kar sakta hai.
        HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}
        def work():
            try:
                r = requests.post(url + "/api/auth/login", json={
                    "usernameEmail": self.e_user.get(),
                    "password": self.e_pass.get(),
                }, headers=HEADERS, timeout=15)
                try:
                    body = r.json()
                except Exception as je:
                    # Response JSON nahi — asli cheez dikhao (status, type, body preview)
                    preview = (r.text or "")[:200].replace(chr(10), " ").replace(chr(13), "")
                    raise RuntimeError(
                        f"server ne JSON nahi bheja (status {r.status_code}, "
                        f"type={r.headers.get('content-type', '?')}) body: {preview}"
                    )
                if not body.get("success"):
                    raise RuntimeError((body.get("error") or {}).get("message", "Login failed"))
                self.token = body["data"]["accessToken"]
                self._log("Login OK — admin token acquired", "ok")
                self.root.after(0, lambda: self.l_login.config(text="✓ Logged in", foreground="#7ee787"))
            except Exception as e:
                self._log(f"Login FAIL: {e}", "err")
            finally:
                self.root.after(0, lambda: self.set_busy(False))
        threading.Thread(target=work, daemon=True).start()

    def gen_serial(self):
        if self.busy:
            return
        if not self.cur_order_id:
            messagebox.showwarning("Order", "Pehle order fetch karo — serial order se linked hota hai")
            return
        self._log("Serial generate ho raha hai (server)…", "info")
        threading.Thread(target=self._gen_serial_worker, daemon=True).start()

    def _gen_serial_worker(self):
        # Server-side serial — registry me create + order se link.
        # Har call naya serial (quantity-aware), sab ban jane pe done=true.
        try:
            data = self.api("POST", f"/api/admin/orders/{self.cur_order_id}/serials/generate")
            if data.get("done"):
                self._log("Order ke saare serials generate ho chuke — Next Board dabao ya naya order fetch karo", "ok")
                return
            code = data.get("serialCode") or ""
            if not code:
                raise RuntimeError("server ne serial wapas nahi bheja")
            self.generated_serials.append(code)
            self.root.after(0, lambda c=code: (self.e_serial.delete(0, "end"),
                                               self.e_serial.insert(0, c),
                                               self.l_prog.config(text="Serial ✓", foreground="#7ee787")))
            self._log(f"Serial: {code}", "ok")
        except Exception as e:
            self._log(f"Serial generate FAIL: {e}", "err")

    def _gen_apikey_worker(self):
        """Order fetch pe API key nahi mili (buyer ka home nahi) to server pe
        create karo — userId/homeId pe permanently bind hota hai."""
        try:
            data = self.provision_data or {}
            uid = (data.get("user") or {}).get("id")
            if not uid:
                raise RuntimeError("order me user nahi mila")
            kd = self.api("POST", "/api/admin/api-keys", json={
                "userId": uid,
                "label": f"factory-order-{self.cur_order_no or self.cur_order_id}",
            })
            plain = (kd or {}).get("apiKey") or ""
            if not plain:
                raise RuntimeError("server ne API key wapas nahi bheja")
            self.provision_data["apiKey"] = plain
            self.root.after(0, lambda k=plain: (self.e_apikey.delete(0, "end"),
                                                self.e_apikey.insert(0, k),
                                                self.l_prog.config(text="API key ✓", foreground="#7ee787")))
            self._log(f"API key generated (server): {plain[:8]}… — user se bind", "ok")
        except Exception as e:
            self._log(f"API key generate FAIL: {e}", "err")

    def do_fetch(self):
        if self.busy:
            return
        if requests is None:
            messagebox.showerror("requests missing", f"Order fetch ke liye requests chahiye.\n\nInstall: {INSTALL_CMD}")
            return
        oid = self.e_order.get().strip()
        if not oid:
            messagebox.showwarning("Order", "Order number ya ID daalo (e.g. 7 ya AR5HUN5K)")
            return
        self.set_busy(True)
        def work():
            try:
                data = self.api("GET", f"/api/admin/orders/{oid}/provision")
                items = data.get("items") or []
                if not items:
                    raise RuntimeError("Order me koi item nahi")
                # Quantity expand — har physical board apna queue entry
                self.order_items = []
                for it in items:
                    qty = int(it.get("quantity") or 1)
                    for _ in range(qty):
                        self.order_items.append(dict(it, quantity=1))
                self.provision_data = data
                self.cur_order_id = data.get("orderId")
                self.cur_order_no = data.get("orderNumber") or ""
                self.generated_serials = []
                boards = len(self.order_items)
                self.board_index = 1  # pehla board
                # Model dropdown me sirf order ke available devices (puri MODELS list nahi)
                models = []
                for it in self.order_items:
                    m = it.get("modelCode")
                    if m and m not in models:
                        models.append(m)
                self.order_models = models
                self.root.after(0, lambda ms=models: self.cb_model.configure(values=ms or MODELS))
                self._fill_item(self.order_items[0])
                self.root.after(0, lambda d=data, n=boards: self.l_orderinfo.config(
                    text=f"#{d['orderNumber']} · buyer {d['user']['username']} · {n} board(s) · {d['status']}"))
                self._log(f"Order #{data['orderNumber']} fetched — {boards} board(s), buyer {data['user']['username']}", "ok")
                if data.get("wifiSsid"):
                    self._log(f"WiFi from order: {data['wifiSsid']} (password encrypted stored — abhi flasher ko mila)", "info")
            except Exception as e:
                self._log(f"Fetch FAIL: {e}", "err")
            finally:
                self.root.after(0, lambda: self.set_busy(False))
        threading.Thread(target=work, daemon=True).start()

    def _fill_item(self, item):
        data = self.provision_data or {}
        self.e_serial.delete(0, "end")
        if item.get("serialCode"):
            self.e_serial.insert(0, item["serialCode"])
        if item.get("modelCode"):
            self.cb_model.set(item["modelCode"])
        self.e_ssid.delete(0, "end")
        if data.get("wifiSsid"):
            self.e_ssid.insert(0, data["wifiSsid"])
        else:
            # Order-time WiFi nahi diya → default factory WiFi auto-fill
            self.e_ssid.insert(0, "Robo_lab")
            self._log("WiFi order me nahi tha — default 'Robo_lab' auto-fill", "info")
        self.e_wpass.delete(0, "end")
        if data.get("wifiPassword"):
            self.e_wpass.insert(0, data["wifiPassword"])
        else:
            self.e_wpass.insert(0, "Robosphere")
            self._log("WiFi pass order me nahi tha — default 'Robosphere' auto-fill", "info")
        self.e_apikey.delete(0, "end")
        if data.get("apiKey"):
            self.e_apikey.insert(0, data["apiKey"])
        elif self.cur_order_id:
            # Order me key nahi mili (buyer ka home nahi) → GUI me hi generate + server pe create
            self._log("API key order me nahi mila — server se generate ho raha hai…", "info")
            threading.Thread(target=self._gen_apikey_worker, daemon=True).start()
        self.cur_serial = item.get("serialCode") or ""
        # Har naye board ke liye fresh serial server se (order-linked).
        # Item serialCode pehla serial hi dikhata hai — jo pehle generate ho
        # chuka wo dobara use na ho isliye generated_serials me track karte hain.
        already_used = self.cur_serial in self.generated_serials
        if (not self.cur_serial or already_used) and self.cur_order_id:
            self._log("Naya board — server se serial generate ho raha hai…", "info")
            threading.Thread(target=self._gen_serial_worker, daemon=True).start()
        self.l_item.config(text=f"▶ {item.get('productName', '')}")

    def do_next(self):
        if self.busy:
            return
        if not self.order_items:
            self._log("Queue khali hai — pehle order fetch karo (ya manual bharo)", "warn")
            return
        self.order_items.pop(0)
        self.board_index += 1  # agla board (hotspot _N suffix)
        if self.order_items:
            self._fill_item(self.order_items[0])
            left = len(self.order_items)
            self.root.after(0, lambda n=left, it=self.order_items[0]: self.l_orderinfo.config(
                text=f"#{self.cur_order_no} · {n} board(s) baki → {it.get('productName', '')}"))
            self._log(f"Next board → {self.order_items[0].get('productName', '')} ({left} baki)", "info")
        else:
            self.root.after(0, lambda: self.l_orderinfo.config(text="✔ order complete — naya order fetch karo"))
            self._log("Order ke saare boards ho gaye. Naya order fetch karo.", "ok")

    def _com(self):
        port = self.cb_port.get().strip()
        if not port:
            raise RuntimeError("COM port choose karo")
        return port

    def _run_esptool(self, args):
        """Call esptool in-process (PyInstaller exe me `python -m esptool` nahi chalta).

        Windowed exe me sys.stdout/stderr = None hote hain — esptool import ke
        waqt ise console-like stream chahiye, warna CLI parsing exit-code 2 se
        fail karta hai. Isliye import se PEHLE real stream (NUL) laga dete hain,
        phir StringIO me capture karke GUI log me dikhate hain.
        """
        ANSI_RE = re.compile(r"\u001b\[[0-9;]*[A-Za-z]")

        old_out, old_err = sys.stdout, sys.stderr
        if old_out is None or old_err is None:
            # Windowed exe — NUL pe real stream (import ke waqt esptool ko chahiye)
            real = open(os.devnull, "w")
            sys.stdout, sys.stderr = real, real
        try:
            import esptool
        except ImportError:
            sys.stdout, sys.stderr = old_out, old_err
            raise RuntimeError("esptool bundled nahi hai — flasher .exe rebuild karo")

        cap_out, cap_err = io.StringIO(), io.StringIO()
        sys.stdout, sys.stderr = cap_out, cap_err
        try:
            try:
                esptool.main(args)
            except SystemExit as e:
                if e.code not in (0, None):
                    raise RuntimeError(f"esptool failed (exit code {e.code})")
            except RuntimeError:
                raise
            except Exception as e:
                raise RuntimeError(f"esptool error: {e}")
        finally:
            sys.stdout, sys.stderr = old_out, old_err
            out = cap_out.getvalue() + cap_err.getvalue()
            for line in out.splitlines():
                line = ANSI_RE.sub("", line).strip()
                if line:
                    self._log("  " + line)

    def do_flash(self):
        if self.busy:
            return
        if self.monitor_on:
            messagebox.showwarning("Serial Monitor",
                                   "Serial Monitor ON hai — Close Serial Monitor dabao, phir Flash karo (port busy hai)")
            return
        if requests is None:
            self._log(f"Flash disabled — requests missing. Install: {INSTALL_CMD}", "err")
            return
        model_confirm = self.cb_model.get().strip()
        serial_now = self.e_serial.get().strip()
        apikey_now = self.e_apikey.get().strip()
        order_no = self.cur_order_no or self.e_order.get().strip()
        if not messagebox.askyesno(
            "Confirm Board — Flash",
            f"Are you sure yeh {model_confirm} board hai?\n\n"
            f"Order  : {order_no}\n"
            f"Model  : {model_confirm}\n"
            f"Serial : {serial_now or '(khali — flash se pehle generate + bind hoga)'}\n"
            f"API key: {apikey_now[:12] + '…' if apikey_now else '(khali — flash se pehle create + bind hoga)'}\n\n"
            "OK pe serial + API key is order ke user se permanently bind ho jayega, phir flash shuru hoga.",
        ):
            self._log("Flash cancelled (confirmation me No)", "warn")
            return
        self.set_busy(True)
        def work():
            nonlocal serial_now, apikey_now
            try:
                # Permanent bind — serial + API key order ke user se (confirm ke baad)
                if not serial_now and self.cur_order_id:
                    self._log("Serial khali — server se generate + order se bind ho raha hai…", "info")
                    sd = self.api("POST", f"/api/admin/orders/{self.cur_order_id}/serials/generate")
                    code = (sd or {}).get("serialCode")
                    if code:
                        serial_now = code
                        self.root.after(0, lambda c=code: (self.e_serial.delete(0, "end"), self.e_serial.insert(0, c)))
                        self._log(f"Serial bound: {code}", "ok")
                if not serial_now:
                    raise RuntimeError("Serial code required — generate nahi hua, flash roka gaya")
                if not apikey_now:
                    uid = (self.provision_data or {}).get("user", {}).get("id")
                    if uid:
                        self._log("API key khali — server pe create + user se bind ho raha hai…", "info")
                        kd = self.api("POST", "/api/admin/api-keys", json={
                            "userId": uid,
                            "label": f"factory-order-{order_no or self.cur_order_id}",
                        })
                        plain = (kd or {}).get("apiKey")
                        if plain:
                            apikey_now = plain
                            self.root.after(0, lambda k=plain: (self.e_apikey.delete(0, "end"), self.e_apikey.insert(0, k)))
                            self._log(f"API key bound: {plain[:8]}…", "ok")
                if not apikey_now:
                    raise RuntimeError("API key required — create nahi hua, flash roka gaya")
                self._log(f"BIND ok — serial {serial_now[:14]}… · api key {apikey_now[:8]}…", "ok")
                port = self._com()
                # Model-specific file pehle try karo (firmware-4ch.bin), fallback firmware.bin
                model = self.cb_model.get().strip().lower()
                candidates = [f"firmware-{model}.bin"] if model else []
                candidates.append("firmware.bin")
                base = self.e_server.get().rstrip("/") + "/firmware/"
                got = None
                for nm in candidates:
                    self._log(f"Downloading {nm} from server…", "info")
                    r = requests.get(base + nm, timeout=60)
                    if r.status_code == 200:
                        got = r
                        break
                    self._log(f"  {nm} -> {r.status_code}, agla try…", "warn")
                if got is None:
                    raise RuntimeError(
                        "firmware download fail — server pe koi .bin nahi mila (" +
                        ", ".join(candidates) + ")"
                    )
                bin_path = "firmware.bin"
                with open(bin_path, "wb") as fh:
                    fh.write(got.content)
                self._log(f"Downloaded {len(got.content) / 1e6:.2f} MB → {bin_path}", "ok")
                # 460800 fast — par kuch boards/cables ispe mid-flash reset karte hain
                # ("No more data to read"). Fail pe 115200 (stable) pe ek retry.
                for attempt, baud in enumerate((460800, 115200)):
                    if attempt > 0:
                        self._log(f"  Retry at {baud} baud (stable)…", "warn")
                        time.sleep(2)
                    self._log(f"Flashing (esptool @ {baud})…", "info")
                    try:
                        self._run_esptool(["--port", port, "--baud", str(baud),
                                           "write_flash", FLASH_ADDR, bin_path])
                        self._log("Flash OK — board rebooting…", "ok")
                        break
                    except Exception as e:
                        if attempt == 0:
                            self._log(f"Flash @{baud} fail: {e} — 115200 retry…", "warn")
                            continue
                        raise
                time.sleep(3)
            except FileNotFoundError:
                self._log("esptool nahi mila — `pip install esptool` karo", "err")
            except Exception as e:
                self._log(f"Flash FAIL: {e}", "err")
            finally:
                self.root.after(0, lambda: self.set_busy(False))
        threading.Thread(target=work, daemon=True).start()

    # ---- serial provisioning ----

    def _open_ser(self):
        if serial is None:
            raise RuntimeError("pyserial not installed")
        port = self._com()
        self.ser = serial.Serial(port, BAUD, timeout=0.3)
        self.ser.reset_input_buffer()
        self._log(f"Serial {port} @ {BAUD} open", "info")

    def _close_ser(self):
        if self.ser:
            try:
                self.ser.close()
            except Exception:
                pass
            self.ser = None

    def _send_cmd(self, cmd, expect=("OK", "ERR"), timeout=8, echo=True):
        """Send a serial command, return the full reply, waiting for an expect token."""
        self.ser.reset_input_buffer()
        self.ser.write((cmd + "\n").encode())
        if echo:
            self._log(f"> {cmd}")
        deadline = time.time() + timeout
        buf = ""
        while time.time() < deadline:
            chunk = self.ser.read(256).decode(errors="replace")
            if chunk:
                buf += chunk
            for tok in expect:
                if tok in buf:
                    return buf
            if "[FAIL]" in buf:
                return buf
        return buf

    # Firmware banner — v1 me "Robosphere", naye firmware me "SwitchNest".
    # Dono accept karo taaki purane + naye dono builds provision ho sakein.
    FIRMWARE_BANNERS = ("Robosphere IoT Firmware", "SwitchNest IoT Firmware")

    def _wait_banner(self, timeout=20):
        deadline = time.time() + timeout
        buf = ""
        while time.time() < deadline:
            chunk = self.ser.read(256).decode(errors="replace")
            if chunk:
                buf += chunk
            if any(b in buf for b in self.FIRMWARE_BANNERS):
                return buf
        return buf

    def _verify_hotspot(self, expected_name, expected_password, timeout=6):
        """Factory quality check — board ka saved AP naam/password sticker ke
        hotspot naam se match hona chahiye (config export parse karke).
        Export mila nahi (purana firmware) → WARN; mismatch → FAIL (quality gate)."""
        self.ser.reset_input_buffer()
        self.ser.write(b"export\n")
        self._log("> export  (hotspot verify)", "info")
        deadline = time.time() + timeout
        buf = ""
        while time.time() < deadline:
            chunk = self.ser.read(256).decode(errors="replace")
            if chunk:
                buf += chunk
            if "CONFIG EXPORT END" in buf:
                break
        m = re.search(r"CONFIG EXPORT\s*=+(.*?)CONFIG EXPORT END", buf, re.S)
        if not m:
            self._log("Hotspot verify: export response nahi mila — purana firmware ho sakta hai (skip, manual monitor se check karo)", "warn")
            return False
        body = m.group(1).strip()
        start, end = body.find("{"), body.rfind("}")
        if start < 0 or end <= start:
            self._log("Hotspot verify: export me JSON nahi mila — skip", "warn")
            return False
        try:
            cfg = json.loads(body[start:end + 1])
        except Exception as e:
            self._log(f"Hotspot verify: export parse fail ({e}) — skip", "warn")
            return False
        ap = cfg.get("ap") or {}
        got_name = (ap.get("name") or "").strip()
        got_pass = (ap.get("password") or "").strip()
        if got_name != expected_name or got_pass != expected_password:
            raise RuntimeError(
                "Hotspot MISMATCH — board: '%s' / '%s…', expected: '%s' / '%s…'"
                % (got_name, got_pass[:4], expected_name, expected_password[:4])
            )
        self._log(f"Hotspot verify OK — AP '{got_name}' sticker se match ✓ (password = serial)", "ok")
        return True

    # ---- webserver reach check (quality gate) ----

    def _read_boot_ips(self, timeout=15):
        """finish (reboot) ke baad serial se boot logs padho — AP IP / LAN IP
        lines parse karke set return karo. Board ko reboot hone me ~2-3s lagta
        hai, isliye serial reopen + read window (max `timeout` sec)."""
        ips = set()
        try:
            port = self._com()
            ser = serial.Serial(port, BAUD, timeout=0.3)
            ser.reset_input_buffer()
        except Exception as e:
            self._log(f"Webserver check: serial reopen fail ({e}) — sirf 192.168.4.1 try hoga", "warn")
            return ips
        ap_seen_at = None
        try:
            deadline = time.time() + timeout
            buf = ""
            while time.time() < deadline:
                try:
                    chunk = ser.read(256).decode(errors="replace")
                except Exception:
                    break
                if not chunk:
                    continue
                buf += chunk
                for m in self.BOOT_IP_RE.finditer(buf):
                    ips.add(m.group(1))
                if "192.168.4.1" in ips:
                    if ap_seen_at is None:
                        ap_seen_at = time.time()
                    # AP IP aa gaya — LAN IP ke liye thoda aur wait, phir aage
                    if len(ips) > 1 or time.time() - ap_seen_at > 5:
                        break
        finally:
            try:
                ser.close()
            except Exception:
                pass
        return ips

    def _http_status(self, ip, timeout=2.5):
        """HTTP GET — webserver UP hai to status code (4xx/5xx bhi = server
        response de raha hai), unreachable/unresponsive to None."""
        try:
            with urllib.request.urlopen(f"http://{ip}/", timeout=timeout) as r:
                return r.status
        except urllib.error.HTTPError as e:
            return e.code
        except Exception:
            return None

    def _check_webserver(self):
        """Provision+reboot ke baad board ka webserver HTTP-ping (quality check).
        AP (192.168.4.1) dual-mode me HAMESHA ON hota hai — par PC ko board ke
        hotspot ya same LAN pe hona chahiye. LAN IP boot logs se parse karke
        bhi try hota hai. Result GUI log me dikhta hai (provision fail nahi —
        network topology ke karan false-negative ho sakta hai)."""
        self._log("Webserver check — board reboot ho raha hai, boot logs se IP dhoondh rahe hain…", "info")
        boot_ips = self._read_boot_ips(15)
        lan_ips = sorted(ip for ip in boot_ips if ip != "192.168.4.1")
        if lan_ips:
            self._log(f"Boot logs: AP 192.168.4.1 · LAN {', '.join(lan_ips)}", "info")
        elif "192.168.4.1" in boot_ips:
            self._log("Boot logs: sirf AP 192.168.4.1 mila (board WiFi se connect nahi hua / slow hai)", "info")
        else:
            self._log("Boot logs me IP line nahi mili — serial window miss hui, sirf 192.168.4.1 try karenge", "warn")

        results = []  # (label, http status)
        # AP pe retries — board ko boot hone + webserver start hone me time lagta hai
        for attempt in range(6):
            code = self._http_status("192.168.4.1", timeout=2)
            if code is not None:
                results.append(("http://192.168.4.1/ (AP)", code))
                break
            if attempt < 5:
                time.sleep(2)
        for ip in lan_ips:
            code = self._http_status(ip, timeout=2.5)
            if code is not None:
                results.append((f"http://{ip}/ (LAN)", code))

        if results:
            detail = " · ".join(f"{label} → {code}" for label, code in results)
            self._log(f"✅ Web server reachable — {detail}", "ok")
            return True
        self._log(
            "❌ Web server unreachable — PC board ke hotspot (192.168.4.1) ya same LAN "
            "pe connected hona chahiye. Serial Monitor kholo + RESET dabao, boot logs me "
            "AP IP / IP browser me daal ke manually check karo.", "warn"
        )
        return False

    def do_provision(self):
        if self.busy:
            return
        if self.monitor_on:
            messagebox.showwarning("Serial Monitor",
                                   "Serial Monitor ON hai — Close Serial Monitor dabao, phir Provision karo (port busy hai)")
            return
        if serial is None:
            messagebox.showerror("pyserial", "pip install pyserial")
            return
        self.set_busy(True)
        def work():
            try:
                ssid = self.e_ssid.get().strip()
                wpass = self.e_wpass.get().strip()
                apikey = self.e_apikey.get().strip()
                serial_code = self.e_serial.get().strip().upper()
                model = self.cb_model.get().strip().upper()
                esp_url = self.e_esp_server.get().strip()

                if not ssid or not wpass:
                    raise RuntimeError("WiFi SSID/password required")
                if not apikey:
                    raise RuntimeError("API key required")
                if not serial_code:
                    raise RuntimeError("Serial code required")
                if " " in serial_code:
                    raise RuntimeError("Serial me space nahi ho sakta")
                if not esp_url:
                    raise RuntimeError("ESP Server URL required")

                self._open_ser()
                self._log("Waiting for board…", "info")
                banner = self._wait_banner(25)
                if not any(b in banner for b in self.FIRMWARE_BANNERS):
                    raise RuntimeError(
                        "Board nahi mila — firmware flashed hai? Cable/baud check karo"
                        + (f" (serial pe: {banner[-80:]!r})" if banner.strip() else "")
                    )
                self._log("Board detected ✓", "ok")

                r = self._send_cmd(f"setwifi {ssid} {wpass}")
                self._check_ok(r, "setwifi")
                r = self._send_cmd(f"setserver {esp_url} {apikey}")
                self._check_ok(r, "setserver")

                # Hotspot naming: UserName_OrderID-last-letters (+ _N agar order
                # me multiple devices) — sticker ke naam se match. Password = serial key.
                username = (self.provision_data or {}).get("user", {}).get("username", "")
                order_no = self.cur_order_no or ""
                hotspot = ""
                if username and order_no:
                    hotspot = f"{username}_{order_no[-6:]}"
                    if len(self.order_items) > 1:
                        hotspot += f"_{self.board_index}"
                if not hotspot and serial_code:
                    hotspot = f"SwitchNest-{serial_code}"
                if hotspot:
                    r = self._send_cmd(f"setapname {hotspot}")
                    self._check_ok(r, "setapname")
                    self._log(f"Hotspot: {hotspot} (password = serial key)", "info")
                r = self._send_cmd(f"setappass {serial_code}")
                self._check_ok(r, "setappass")

                r = self._send_cmd(f"setserial {serial_code}")
                self._check_ok(r, "setserial")
                r = self._send_cmd(f"setmodel {model}")
                self._check_ok(r, "setmodel")

                # Factory quality check: board ka saved hotspot sticker se match
                # (export JSON parse — naam + password dono verify, mismatch = FAIL).
                self._verify_hotspot(hotspot, serial_code)

                # relay self-test — board jaldi reboot kare isse pehle
                self._log("Relay self-test…", "info")
                r = self._send_cmd("testrelay", expect=("SELF-TEST END",), timeout=60)
                fails = re.findall(r"RELAY \d+ FAIL", r)
                oks = re.findall(r"RELAY \d+ OK", r)
                for m in re.findall(r"(RELAY \d+ (?:OK|FAIL))", r):
                    self._log("  " + m, "ok" if m.endswith("OK") else "err")
                if fails:
                    raise RuntimeError(f"Self-test FAIL: {', '.join(fails)}")
                if not oks:
                    raise RuntimeError("Self-test me koi relay response nahi aaya")

                self._log("Config complete — finishing (reboot)…", "info")
                self._send_cmd("finish", expect=("Restarting",), timeout=5)
                self._close_ser()
                # Quality check: reboot ke baad webserver AP/LAN IP pe HTTP-ping
                web_ok = self._check_webserver()
                self._log(f"Provisioning OK → {serial_code} ({model}) | WiFi: {ssid} | server: {esp_url}", "ok")
                self.root.after(0, lambda: self.l_prog.config(
                    text="Provisioned ✓ · Web OK" if web_ok else "Provisioned ✓ · Web ⚠",
                    foreground="#7ee787" if web_ok else "#fbbf24"))
            except Exception as e:
                self._log(f"Provision FAIL: {e}", "err")
                self._close_ser()
            finally:
                self.root.after(0, lambda: self.set_busy(False))
        threading.Thread(target=work, daemon=True).start()

    def _check_ok(self, reply, cmd):
        if "ERR" in reply and "[OK]" not in reply:
            raise RuntimeError(f"{cmd} rejected: {reply.strip()[-200:]}")
        self._log(f"{cmd} ✓", "ok")

    def do_mark(self):
        if self.busy:
            return
        code = self.e_serial.get().strip().upper()
        if not code:
            messagebox.showwarning("Serial", "Pehle serial code daalo")
            return
        self.set_busy(True)
        def work():
            try:
                data = self.api("POST", f"/api/admin/serials/{code}/mark-tested")
                self._log(f"Marked tested: {data['serialCode']} (server OK)", "ok")
                self.root.after(0, lambda: self.l_prog.config(text="Tested ✓", foreground="#7ee787"))
            except Exception as e:
                self._log(f"Mark FAIL: {e}", "err")
            finally:
                self.root.after(0, lambda: self.set_busy(False))
        threading.Thread(target=work, daemon=True).start()

    # ---------------- serial monitor (inline toggle) ----------------

    def toggle_monitor(self):
        """Serial Monitor on/off — button hi toggle hai. ON pe output niche
        panel me dikhta hai aur button 'Close Serial Monitor' ban jata hai."""
        if self.busy:
            return
        if self.monitor_on:
            self.stop_monitor()
        else:
            self.start_monitor()

    def start_monitor(self):
        if serial is None:
            messagebox.showerror("pyserial", "Serial monitor ke liye pyserial chahiye.\n\npip install pyserial")
            return
        port = self.cb_port.get().strip()
        if not port:
            messagebox.showwarning("COM port", "Pehle COM port choose karo (⟳ se refresh)")
            return
        try:
            self.mon_ser = serial.Serial(port, BAUD, timeout=0.3)
            self.mon_ser.reset_input_buffer()
        except Exception as e:
            self._log(f"Serial monitor FAIL ({port}): {e}", "err")
            return
        self.monitor_on = True
        self.mon_stop = threading.Event()
        self.mon_q = queue.Queue()
        self.b_monitor.config(text="⏹ Close Serial Monitor")
        self.l_mon_state.config(text=f"● {port} @ {BAUD} — live", foreground="#7ee787")
        self.mon_frame.grid()
        self.mon_out.delete("1.0", "end")
        self._mon_write(f"[monitor] {port} @ {BAUD} open — board ka output yahan aayega.\n")
        self._mon_write("[monitor] Board pe RESET dabao (boot logs: AP SSID / AP IP / IP) ya niche command bhejo (e.g. help).\n", "ok")
        self._log(f"Serial monitor ON — {port} @ {BAUD}", "ok")
        threading.Thread(target=self._mon_reader, daemon=True).start()
        self.root.after(100, self._drain_mon)

    def stop_monitor(self):
        self.monitor_on = False
        if self.mon_stop:
            self.mon_stop.set()
        if self.mon_ser:
            try:
                self.mon_ser.close()
            except Exception:
                pass
            self.mon_ser = None
        self.b_monitor.config(text="🔍 Serial Monitor")
        self.l_mon_state.config(text="")
        self.mon_frame.grid_remove()
        self._log("Serial monitor OFF — port release", "info")

    def _mon_write(self, text, tag=None):
        self.mon_out.insert("end", text, tag or ())
        self.mon_out.see("end")

    def _mon_reader(self):
        while not self.mon_stop.is_set():
            try:
                chunk = self.mon_ser.read(256)
                if chunk:
                    self.mon_q.put(chunk.decode(errors="replace"))
            except Exception as e:
                self.mon_q.put(f"\n[monitor] read error: {e}\n")
                break

    def _drain_mon(self):
        if not self.monitor_on:
            return
        try:
            while True:
                self._mon_write(self.mon_q.get_nowait())
        except queue.Empty:
            pass
        self.root.after(100, self._drain_mon)

    def mon_send(self):
        if not self.monitor_on or self.mon_ser is None:
            return
        cmd = self.mon_cmd.get().strip()
        if not cmd:
            return
        self.mon_cmd.delete(0, "end")
        try:
            self.mon_ser.write((cmd + "\n").encode())
            self._mon_write(f"\n> {cmd}\n", "ok")
        except Exception as e:
            self._mon_write(f"\n[monitor] send fail: {e}\n", "err")

    def mon_clear(self):
        self.mon_out.delete("1.0", "end")

    def on_close(self):
        """App band karte waqt monitor port bhi release karo (koi zombie nahi)."""
        self.stop_monitor()
        self.root.destroy()


def main():
    # CLI dep check — GUI ke bina verify (CI / fresh env diagnostic ke liye)
    if "--check" in sys.argv:
        missing = check_deps()
        if missing:
            print(f"MISSING: {', '.join(missing)}")
            print(f"Install: {INSTALL_CMD}")
            sys.exit(1)
        print("OK — requests, pyserial, esptool sab present")
        sys.exit(0)

    if sys.platform.startswith("win"):
        try:
            import ctypes
            ctypes.windll.shcore.SetProcessDpiAwareness(1)
        except Exception:
            pass
    root = tk.Tk()
    try:
        style = ttk.Style(root)
        if "vista" in style.theme_names():
            style.theme_use("vista")
    except Exception:
        pass
    FlasherApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
