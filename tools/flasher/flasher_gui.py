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

import json
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
        root.geometry("980x720")
        root.configure(bg="#0f0f1e")

        self.token = None
        self.ser = None
        self.busy = False
        self.log_q = queue.Queue()
        self.order_items = []  # pending batch queue
        self.cur_serial = ""

        self._build_ui()
        self._log("RoboSphere Factory Flasher ready.")
        if serial is None:
            self._log("[WARN] pyserial not installed — provisioning/test disabled. pip install pyserial")
        self.root.after(100, self._drain_log)

    # ---------------- UI ----------------

    def _build_ui(self):
        pad = {"padx": 6, "pady": 3}
        f = ttk.Frame(self.root, padding=10)
        f.pack(fill="both", expand=True)

        # Row 0 — connection
        row = ttk.LabelFrame(f, text="1 · Server Connection", padding=8)
        row.pack(fill="x", **pad)
        ttk.Label(row, text="Site URL").grid(row=0, column=0, sticky="w")
        self.e_server = ttk.Entry(row, width=34)
        self.e_server.insert(0, "http://localhost:4000")
        self.e_server.grid(row=0, column=1, padx=4)
        ttk.Label(row, text="Admin user").grid(row=0, column=2, sticky="w")
        self.e_user = ttk.Entry(row, width=14)
        self.e_user.insert(0, "admin")
        self.e_user.grid(row=0, column=3, padx=4)
        ttk.Label(row, text="Password").grid(row=0, column=4, sticky="w")
        self.e_pass = ttk.Entry(row, width=14, show="*")
        self.e_pass.grid(row=0, column=5, padx=4)
        self.b_login = ttk.Button(row, text="Login", command=self.do_login)
        self.b_login.grid(row=0, column=6, padx=4)
        self.l_login = ttk.Label(row, text="Not logged in", foreground="orange")
        self.l_login.grid(row=0, column=7, padx=8)
        ttk.Label(row, text="ESP Server URL (board ko dikhe)")\
            .grid(row=1, column=0, sticky="w", pady=(6, 0))
        self.e_esp_server = ttk.Entry(row, width=34)
        self.e_esp_server.insert(0, f"http://{detect_lan_ip()}:4000")
        self.e_esp_server.grid(row=1, column=1, padx=4, pady=(6, 0))

        # Row 1 — order + device (wide fields — lamba order number ab pura dikhta hai)
        row = ttk.LabelFrame(f, text="2 · Order / Device", padding=10)
        row.pack(fill="x", **pad)
        row.columnconfigure(1, weight=1)
        row.columnconfigure(5, weight=1)

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
        row = ttk.LabelFrame(f, text="3 · Flash & Provision", padding=8)
        row.pack(fill="x", **pad)
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

        # Row 3 — log
        row = ttk.LabelFrame(f, text="Log", padding=8)
        row.pack(fill="both", expand=True, **pad)
        self.log = scrolledtext.ScrolledText(row, height=16, bg="#0b0b16", fg="#d0d7de",
                                             insertbackground="#d0d7de", font=("Consolas", 10))
        self.log.pack(fill="both", expand=True)
        self.log.tag_configure("ok", foreground="#7ee787")
        self.log.tag_configure("err", foreground="#ff7b72")
        self.log.tag_configure("warn", foreground="#d29922")
        self.log.tag_configure("info", foreground="#58a6ff")

        status = ttk.Label(f, text="• 1) Flash  →  2) Provision + Relay test  →  3) Mark tested  →  Next board",
                           foreground="#8b949e")
        status.pack(fill="x", padx=6, pady=(0, 2))

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
        def work():
            try:
                r = requests.post(url + "/api/auth/login", json={
                    "usernameEmail": self.e_user.get(),
                    "password": self.e_pass.get(),
                }, timeout=10)
                body = r.json()
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
        model = self.cb_model.get()
        chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        import random
        code = "RS-" + model + "-" + "".join(random.choice(chars) for _ in range(6))
        self.e_serial.delete(0, "end")
        self.e_serial.insert(0, code)
        self._log(f"Generated serial: {code}", "info")

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
                self.order_items = list(items)
                self._fill_item(items[0], data)
                self.root.after(0, lambda d=data, n=len(items): self.l_orderinfo.config(
                    text=f"#{d['orderNumber']} · buyer {d['user']['username']} · {n} item(s) · {d['status']}"))
                self._log(f"Order #{data['orderNumber']} fetched — {len(items)} item(s), buyer {data['user']['username']}", "ok")
                if data.get("wifiSsid"):
                    self._log(f"WiFi from order: {data['wifiSsid']} (password encrypted stored — abhi flasher ko mila)", "info")
            except Exception as e:
                self._log(f"Fetch FAIL: {e}", "err")
            finally:
                self.root.after(0, lambda: self.set_busy(False))
        threading.Thread(target=work, daemon=True).start()

    def _fill_item(self, item, data):
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
        self.l_item.config(text=f"▶ {item.get('productName', '')} × {item.get('quantity', 1)}")

    def do_next(self):
        if self.busy:
            return
        if not self.order_items:
            self._log("Queue khali hai — pehle order fetch karo (ya manual bharo)", "warn")
            return
        self.order_items.pop(0)
        if self.order_items:
            self._fill_item(self.order_items[0], {})
            self.root.after(0, lambda: self.l_orderinfo.config(text=f"item {len(self.order_items) + 1} → {self.order_items[0].get('productName', '')}"))
            self._log(f"Next item → {self.order_items[0].get('productName', '')}", "info")
        else:
            self.root.after(0, lambda: self.l_orderinfo.config(text="✔ order complete — naya order fetch karo"))
            self._log("Order ke saare items ho gaye. Naya order fetch karo.", "ok")

    def _com(self):
        port = self.cb_port.get().strip()
        if not port:
            raise RuntimeError("COM port choose karo")
        return port

    def _run_esptool(self, args):
        """Call esptool in-process (PyInstaller exe me `python -m esptool` nahi chalta).

        stdout/stderr capture karke GUI log me stream karta hai (progress % tak).
        """
        try:
            import esptool
        except ImportError:
            raise RuntimeError("esptool bundled nahi hai — flasher .exe rebuild karo")

        old_out, old_err = sys.stdout, sys.stderr

        class _Tee:
            def __init__(self, stream, log):
                self.stream = stream
                self.log = log
                self.buf = ""

            def write(self, s):
                self.buf += s
                while True:
                    idx = -1
                    for sep in ("\n", "\r"):
                        i = self.buf.find(sep)
                        if i != -1 and (idx == -1 or i < idx):
                            idx = i
                    if idx == -1:
                        break
                    line, self.buf = self.buf[:idx], self.buf[idx + 1:]
                    if line.strip():
                        self.log("  " + line.strip())
                self.stream.write(s)

            def flush(self):
                self.stream.flush()

        tee = _Tee(old_out, self._log)
        sys.stdout, sys.stderr = tee, tee
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

    def do_flash(self):
        if self.busy:
            return
        self.set_busy(True)
        def work():
            try:
                port = self._com()
                self._log("Downloading firmware.bin from server…", "info")
                url = self.e_server.get().rstrip("/") + "/firmware/firmware.bin"
                r = requests.get(url, timeout=60)
                r.raise_for_status()
                bin_path = "firmware.bin"
                with open(bin_path, "wb") as fh:
                    fh.write(r.content)
                self._log(f"Downloaded {len(r.content) / 1e6:.2f} MB → {bin_path}", "ok")
                self._log("Flashing (esptool)…", "info")
                self._run_esptool(["--port", port, "--baud", "460800",
                                   "write_flash", FLASH_ADDR, bin_path])
                self._log("Flash OK — board rebooting…", "ok")
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
