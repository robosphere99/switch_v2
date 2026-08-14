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
  6. Mark serial as factory-tested on the server
  7. Next board (batch mode)

Requirements:  pip install requests pyserial   (+ esptool for flashing)

Run:           python flasher_gui.py
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
from tkinter import messagebox, scrolledtext, ttk

import requests

try:
    import serial  # pyserial
except ImportError:
    serial = None

MODELS = ["2CH", "4CH", "5CH", "6CH", "8CH", "4CH-IR", "FAN-DIM", "DIM-3S", "DIM-4S"]
BAUD = 115200
FLASH_ADDR = "0x10000"  # ESP32 app partition (standard PlatformIO layout)

APP_VERSION = "1.0"


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
    heartbeat bhejte hain). No actual traffic — sirf route lookup."""
    try:
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.connect(("192.168.1.1", 80))
        ip = sock.getsockname()[0]
        sock.close()
        return ip
    except Exception:
        return "192.168.1.100"


class FlasherApp:
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

        self._build_ui()
        self._log("RoboSphere Factory Flasher ready.")
        if serial is None:
            self._log("[WARN] pyserial not installed — provisioning/test disabled. pip install pyserial")
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
        f = ttk.Frame(self.root, padding=10)
        f.grid(row=0, column=0, sticky="nsew")
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        f.columnconfigure(0, weight=1)

        # Row 0 — connection
        row = ttk.LabelFrame(f, text=" 1 · Server Connection ", padding=8)
        row.grid(row=0, column=0, sticky="ew", **pad)
        row.columnconfigure(1, weight=3)
        row.columnconfigure(3, weight=1)
        row.columnconfigure(5, weight=1)
        ttk.Label(row, text="Site URL").grid(row=0, column=0, sticky="w")
        self.e_server = ttk.Entry(row, width=34)
        self.e_server.insert(0, "https://onlineswitch.bhartitechnical.com")
        self.e_server.grid(row=0, column=1, padx=4)
        ttk.Label(row, text="Admin user").grid(row=0, column=2, sticky="w")
        self.e_user = ttk.Entry(row, width=14)
        self.e_user.insert(0, "admin")
        self.e_user.grid(row=0, column=3, padx=4)
        ttk.Label(row, text="Password").grid(row=0, column=4, sticky="w")
        self.e_pass = ttk.Entry(row, width=14, show="*")
        self.e_pass.grid(row=0, column=5, padx=4)
        self.b_login = ttk.Button(row, text="Login", style="Primary.TButton", command=self.do_login)
        self.b_login.grid(row=0, column=6, padx=4)
        self.l_login = ttk.Label(row, text="Not logged in", foreground="orange")
        self.l_login.grid(row=0, column=7, padx=8)
        ttk.Label(row, text="ESP Server URL (board ko dikhe)")\
            .grid(row=1, column=0, sticky="w", pady=(6, 0))
        self.e_esp_server = ttk.Entry(row, width=34)
        self.e_esp_server.insert(0, f"http://{detect_lan_ip()}:4000")
        self.e_esp_server.grid(row=1, column=1, padx=4, pady=(6, 0))

        # Row 1 — order + device (wide fields — lamba order number ab pura dikhta hai)
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

        ttk.Label(row, text="Serial code").grid(row=1, column=0, sticky="w", pady=2)
        self.e_serial = ttk.Entry(row, width=22)
        self.e_serial.grid(row=1, column=1, padx=4, pady=2, sticky="ew")
        self.b_gen = ttk.Button(row, text="Generate", command=self.gen_serial)
        self.b_gen.grid(row=1, column=2, padx=4, pady=2)
        ttk.Label(row, text="Model").grid(row=1, column=3, sticky="w", pady=2, padx=(12, 0))
        self.cb_model = ttk.Combobox(row, values=MODELS, width=8, state="readonly")
        self.cb_model.set("4CH")
        self.cb_model.grid(row=1, column=4, padx=4, pady=2)

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

        # Row 2 — port + actions
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
        self.b_next = ttk.Button(row, text="Next Board ▸", command=self.do_next)
        self.b_next.grid(row=0, column=6, padx=6)
        self.l_prog = ttk.Label(row, text="Idle", foreground="orange")
        self.l_prog.grid(row=0, column=7, padx=8)

        # Row 3 — log (resize pe expand)
        row = ttk.LabelFrame(f, text=" Log ", padding=8)
        row.grid(row=3, column=0, sticky="nsew", **pad)
        f.rowconfigure(3, weight=1)
        self.log = scrolledtext.ScrolledText(row, height=12, bg="#010409", fg="#e6edf3",
                                             insertbackground="#e6edf3", relief="flat",
                                             font=("Consolas", 10))
        self.log.pack(fill="both", expand=True)
        self.log.tag_configure("ok", foreground="#7ee787")
        self.log.tag_configure("err", foreground="#ff7b72")
        self.log.tag_configure("warn", foreground="#d29922")
        self.log.tag_configure("info", foreground="#58a6ff")

        ttk.Label(f, text="Flow: 1) Flash  →  2) Provision + Relay test  →  3) Mark tested  →  Next board",
                  style="Muted.TLabel").grid(row=4, column=0, sticky="w", padx=8, pady=(0, 2))

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
        for b in (self.b_flash, self.b_prov, self.b_mark, self.b_next, self.b_fetch, self.b_login):
            b.config(state="disabled" if busy else "normal")

    def refresh_ports(self):
        ports = find_com_ports()
        self.cb_port["values"] = ports
        if ports and not self.cb_port.get():
            self.cb_port.set(ports[0])
        self._log(f"Ports: {', '.join(ports) if ports else 'none found'}")

    def api(self, method, path, **kw):
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

    def do_login(self):
        if self.busy:
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

    def do_fetch(self):
        if self.busy:
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
        self.e_wpass.delete(0, "end")
        if data.get("wifiPassword"):
            self.e_wpass.insert(0, data["wifiPassword"])
        self.e_apikey.delete(0, "end")
        if data.get("apiKey"):
            self.e_apikey.insert(0, data["apiKey"])
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
        ANSI_RE = re.compile(r"\[[0-9;]*[A-Za-z]")

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
        self.set_busy(True)
        def work():
            try:
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

    def _wait_banner(self, timeout=20):
        deadline = time.time() + timeout
        buf = ""
        while time.time() < deadline:
            chunk = self.ser.read(256).decode(errors="replace")
            if chunk:
                buf += chunk
            if "Robosphere IoT Firmware" in buf:
                return buf
        return buf

    def do_provision(self):
        if self.busy:
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
                if "Robosphere IoT Firmware" not in banner:
                    raise RuntimeError("Board nahi mila — firmware flashed hai? Cable/baud check karo")
                self._log("Board detected ✓", "ok")

                r = self._send_cmd(f"setwifi {ssid} {wpass}")
                self._check_ok(r, "setwifi")
                r = self._send_cmd(f"setserver {esp_url} {apikey}")
                self._check_ok(r, "setserver")
                r = self._send_cmd(f"setserial {serial_code}")
                self._check_ok(r, "setserial")
                r = self._send_cmd(f"setmodel {model}")
                self._check_ok(r, "setmodel")

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
                self._log(f"Provisioning OK → {serial_code} ({model}) | WiFi: {ssid} | server: {esp_url}", "ok")
                self.root.after(0, lambda: self.l_prog.config(text="Provisioned ✓", foreground="#7ee787"))
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


def main():
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
