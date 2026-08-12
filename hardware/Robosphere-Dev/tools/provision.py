#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Robosphere Factory Provisioning Tool
=====================================

Nayi ESP32 board sell karne ke liye — ek command mein:
  1. Firmware flash (PlatformIO build + serial upload)
  2. Factory reset (clean NVS — purana config nahi rehta)
  3. Defaults set karo (serial commands):
       - AP name      (har unit ka unique naam — MAC se auto-generate)
       - AP password  (setup AP ka default)
       - Admin login  (default username/password)
       - Switch mode  (momentary / toggle)
       - OTA URL      (future updates ke liye, optional)
       - Server URL + API key (optional)
  4. Verify (serial config export + boot log)
  5. Label print karo (box pe chipkane ke liye)

Board setup mode mein hi rehta hai — buyer apna WiFi khud set karta hai
(phone se AP se judke 192.168.4.1 kholta hai).

Usage:
  python tools/provision.py --port COM5
  python tools/provision.py --port COM5 --ap-name "Robosphere-001" --admin-pass "1234"
  python tools/provision.py --port COM5 --ota-url "https://example.com/firmware.bin"
  python tools/provision.py --list-ports
  python tools/provision.py          # interactive wizard

Options:
  --port COMx        Serial port (nahi diya toh single port auto-detect)
  --env NAME         PlatformIO env (default: esp32doit-devkit-v1)
  --build            Flash se pehle pio build chalao
  --no-flash         Sirf serial config — firmware already flashed hai
  --no-reset         Factory reset skip (existing config preserve)
  --ap-name NAME     AP SSID ('auto' = MAC se generate)
  --ap-pass PASS     AP password (default: 12345678)
  --admin-user USER  Admin username (default: admin)
  --admin-pass PASS  Admin password (default: admin)
  --switch MODE      momentary | toggle (default: momentary)
  --ota-url URL      OTA check URL (optional)
  --server-url URL   Server URL (optional)
  --api-key KEY      Server API key (optional)
  --list-ports       Available serial ports dikhao
"""

import argparse
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import time

try:
    import serial
except ImportError:
    sys.exit("ERROR: pyserial install nahi hai.\n  pip install pyserial")

# Windows console (cp1252) emoji pe crash karta hai — UTF-8 + replace safe karta hai
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PIO = None  # resolved lazily

BOOT_MARKERS = [
    "Web Server Started",
    "Access Point Started",
    "WiFi Connected",
    "AP SSID :",
    "AP IP :",
    "Setup/AP Mode",
    "Serial Config Commands",
]

DEFAULT_AP_PASS = "12345678"
DEFAULT_ADMIN_USER = "admin"
DEFAULT_ADMIN_PASS = "admin"
DEFAULT_SWITCH = "momentary"


class ProvisionError(Exception):
    pass


# ------------------------------------------------------------
# PlatformIO helpers
# ------------------------------------------------------------
def find_pio():
    exe = shutil.which("pio")
    if exe:
        return exe

    # Windows: APPDATA/LOCALAPPDATA Python Scripts
    for base in (os.environ.get("APPDATA", ""), os.environ.get("LOCALAPPDATA", "")):
        for p in glob.glob(os.path.join(base, "Python", "Python3*", "Scripts", "pio.exe")):
            return p
    return None


def firmware_path(env):
    return os.path.join(PROJECT_ROOT, ".pio", "build", env, "firmware.bin")


def run_pio(args, timeout=600):
    if PIO is None:
        raise ProvisionError("PlatformIO (pio) nahi mila — PATH check karo")
    cmd = [PIO] + args
    print("\n>>> " + " ".join(cmd))
    res = subprocess.run(cmd, cwd=PROJECT_ROOT, capture_output=True, text=True, timeout=timeout)
    if res.stdout:
        print(res.stdout[-4000:])
    if res.stderr:
        print(res.stderr[-2000:])
    if res.returncode != 0:
        raise ProvisionError("Command failed: " + " ".join(cmd))
    return res


def flash(env, port, do_build):
    if not os.path.exists(firmware_path(env)) or do_build:
        run_pio(["run", "-e", env])
    if not os.path.exists(firmware_path(env)):
        raise ProvisionError("firmware.bin nahi bana: " + firmware_path(env))
    run_pio(["run", "-e", env, "-t", "upload", "--upload-port", port])


# ------------------------------------------------------------
# Serial helpers
# ------------------------------------------------------------
def open_serial(port, retries=6):
    # Flash ke turant baad Windows COM port thodi der locked rehta hai —
    # isliye retry. DTR ko False rakho taaki GPIO0 (BOOT) press na ho.
    last = None
    for attempt in range(retries):
        try:
            ser = serial.Serial()
            ser.port = port
            ser.baudrate = 115200
            ser.timeout = 1
            ser.dsrdtr = False
            ser.rtscts = False
            ser.open()
            # GPIO0/DTR footgun: DTR ko turant False karo taaki BOOT button
            # press na ho (purane firmware mein 10s hold = factory reset hota tha).
            try:
                ser.dtr = False
                ser.rts = False
            except Exception:
                pass
            return ser
        except serial.SerialException as e:
            last = e
            time.sleep(1.5)
    raise ProvisionError("Port open nahi hua: %s (%s)" % (port, last))


def read_until(ser, markers, timeout_ms=25000):
    """Markers mein se koi bhi text milne tak read karo. Returns (text, marker|None)."""
    buf = b""
    deadline = time.time() + timeout_ms / 1000.0
    while time.time() < deadline:
        n = ser.in_waiting
        chunk = ser.read(n) if n else ser.read(1)
        if chunk:
            buf += chunk
            text = buf.decode("utf-8", "replace")
            for m in markers:
                if m in text:
                    return text, m
    text = buf.decode("utf-8", "replace")
    return text, None


def wait_ready(ser, timeout_ms=30000):
    """Boot complete hone ya response aane tak wait karo."""
    print("  [serial] waiting for device...")
    text, marker = read_until(ser, BOOT_MARKERS, timeout_ms)
    if marker is None:
        # Probe — device already booted ho sakta hai
        ser.reset_input_buffer()
        ser.write(b"help\n")
        text2, marker = read_until(ser, BOOT_MARKERS + ["Serial Config Commands"], 6000)
        if marker is None:
            raise ProvisionError("Device serial pe respond nahi kar raha — port check karo")
    print("  [serial] device ready")


def send_cmd(ser, cmd, timeout_ms=10000):
    """Command bhejo aur [OK]/[ERR] tak wait karo. Returns (ok, output)."""
    ser.reset_input_buffer()
    ser.write((cmd + "\n").encode())
    buf = b""
    deadline = time.time() + timeout_ms / 1000.0
    while time.time() < deadline:
        n = ser.in_waiting
        chunk = ser.read(n) if n else ser.read(1)
        if chunk:
            buf += chunk
            text = buf.decode("utf-8", "replace")
            if "[OK]" in text or "[ERR]" in text or "Usage:" in text or "Unknown" in text:
                return "[ERR]" not in text and "Usage:" not in text and "Unknown" not in text, text
    text = buf.decode("utf-8", "replace")
    return False, text + "\n[TIMEOUT — no response]"


def read_export(ser, timeout_ms=15000):
    """export command ka JSON nikal lo. Returns (mac, json_dict)."""
    ser.reset_input_buffer()
    ser.write(b"export\n")
    buf = b""
    deadline = time.time() + timeout_ms / 1000.0
    while time.time() < deadline:
        n = ser.in_waiting
        chunk = ser.read(n) if n else ser.read(1)
        if chunk:
            buf += chunk
            if b"===== CONFIG EXPORT END =====" in buf:
                break
    text = buf.decode("utf-8", "replace")
    mac = ""
    m = re.search(r"MAC :\s*([0-9a-fA-F:]+)", text)
    if m:
        mac = m.group(1)
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end < 0:
        raise ProvisionError("export JSON nahi mila:\n" + text[-800:])
    try:
        return mac, json.loads(text[start:end + 1])
    except json.JSONDecodeError as e:
        raise ProvisionError("export JSON parse fail: " + str(e))


def wait_boot_ap_ssid(ser, ap_name, timeout_ms=40000):
    """Reboot ke baad boot log mein 'AP SSID : <name>' confirm karo."""
    text, marker = read_until(ser, ["AP SSID :", "Web Server Started", "WiFi Connected"], timeout_ms)
    if "AP SSID : " + ap_name in text:
        return True
    return False


# ------------------------------------------------------------
# Provisioning
# ------------------------------------------------------------
def provision(args):
    global PIO
    if not args.no_flash:
        PIO = find_pio()
        if PIO is None:
            raise ProvisionError("PlatformIO (pio) nahi mila")
        flash(args.env, args.port, args.build)
        print("\n[1/6] Firmware flashed ✅")
    else:
        print("\n[1/6] Flash skip (--no-flash)")

    ser = open_serial(args.port)
    try:
        wait_ready(ser)

        if not args.no_reset:
            print("[2/6] Factory reset (clean NVS)...")
            ok, out = send_cmd(ser, "factoryreset")
            if not ok:
                raise ProvisionError("factoryreset fail:\n" + out)
            print("      " + out.strip().splitlines()[-1])
            wait_ready(ser, 40000)
        else:
            print("[2/6] Factory reset skip (--no-reset)")

        # AP name — auto = MAC se unique naam
        mac = ""
        try:
            mac, _ = read_export(ser)
        except ProvisionError:
            pass
        if args.ap_name == "auto" or (not args.ap_name and mac):
            suffix = mac.replace(":", "")[-4:].upper() if mac else "%04d" % (time.time() % 10000)
            ap_name = "Robosphere-" + suffix
        else:
            ap_name = args.ap_name or "Robosphere-IoT"

        print("[3/6] Defaults set kar raha hoon...")
        steps = [
            ("setapname " + ap_name, "AP name = " + ap_name),
            ("setappass " + args.ap_pass, "AP password = " + args.ap_pass),
            ("setadmin " + args.admin_user + " " + args.admin_pass,
             "Admin = %s / %s" % (args.admin_user, args.admin_pass)),
            ("setswitch " + args.switch, "Switch mode = " + args.switch),
        ]
        if args.ota_url:
            steps.append(("setotaurl " + args.ota_url, "OTA URL = " + args.ota_url))
        if args.server_url and args.api_key:
            steps.append(("setserver " + args.server_url + " " + args.api_key,
                          "Server = " + args.server_url))

        for cmd, desc in steps:
            ok, out = send_cmd(ser, cmd)
            if not ok:
                raise ProvisionError("Command fail: " + cmd + "\n" + out)
            print("      [OK] " + desc)

        print("[4/6] Verify (config export)...")
        mac, cfg = read_export(ser)
        errors = []
        if cfg.get("ap", {}).get("name") != ap_name:
            errors.append("AP name mismatch: %r" % cfg.get("ap", {}).get("name"))
        if cfg.get("ap", {}).get("password") != args.ap_pass:
            errors.append("AP password mismatch")
        if cfg.get("admin", {}).get("username") != args.admin_user:
            errors.append("admin username mismatch")
        if cfg.get("admin", {}).get("password") != args.admin_pass:
            errors.append("admin password mismatch")
        if cfg.get("switchMode") != (1 if args.switch == "toggle" else 0):
            errors.append("switch mode mismatch")
        if args.ota_url and cfg.get("ota", {}).get("url") != args.ota_url:
            errors.append("OTA URL mismatch")
        if args.server_url and cfg.get("server", {}).get("url") != args.server_url:
            errors.append("server URL mismatch")
        if errors:
            raise ProvisionError("VERIFY FAIL:\n" + "\n".join(errors))
        print("      [OK] Sab defaults verified ✅")

        print("[5/6] Reboot (AP name apply)...")
        send_cmd(ser, "reboot", timeout_ms=3000)
        if wait_boot_ap_ssid(ser, ap_name):
            print("      [OK] Boot log: AP SSID = %s ✅" % ap_name)
        else:
            print("      [!] AP SSID boot log mein confirm nahi hua — manual check karo")

        print("[6/6] Done!")

        if not mac:
            mac = "unknown"
        print_label(ap_name, args, mac)
    finally:
        try:
            ser.close()
        except Exception:
            pass


def print_label(ap_name, args, mac):
    print()
    print("=" * 52)
    print("  ROBOSPHERE IoT — UNIT LABEL")
    print("  MAC: %s" % mac)
    print("=" * 52)
    print("  AP name      : %s" % ap_name)
    print("  AP password  : %s" % args.ap_pass)
    print("  Admin login  : %s / %s" % (args.admin_user, args.admin_pass))
    print("  Switch mode  : %s" % args.switch)
    if args.ota_url:
        print("  OTA URL      : %s" % args.ota_url)
    if args.server_url:
        print("  Server       : %s" % args.server_url)
    print("-" * 52)
    print("  BUYER SETUP:")
    print("  1) Phone/WiFi settings -> '%s' se judo" % ap_name)
    print("     (password: %s)" % args.ap_pass)
    print("  2) Browser mein 192.168.4.1 kholo")
    print("  3) Admin + apna WiFi set karo -> Save")
    print("=" * 52)


def list_ports():
    import serial.tools.list_ports
    ports = list(serial.tools.list_ports.comports())
    if not ports:
        print("Koi serial port nahi mila")
        return
    print("Available serial ports:")
    for p in ports:
        print("  %-8s %s" % (p.device, p.description or ""))


def auto_port():
    import serial.tools.list_ports
    ports = [p.device for p in serial.tools.list_ports.comports()]
    if len(ports) == 1:
        return ports[0]
    if len(ports) == 0:
        raise ProvisionError("Koi serial port nahi mila — --port COMx do")
    raise ProvisionError("Multiple ports: %s — --port COMx do" % ", ".join(ports))


def parse_args(argv):
    p = argparse.ArgumentParser(description="Robosphere factory provisioning tool")
    p.add_argument("--port", help="Serial port (COMx / /dev/ttyUSB0)")
    p.add_argument("--env", default="esp32doit-devkit-v1")
    p.add_argument("--build", action="store_true", help="Flash se pehle build chalao")
    p.add_argument("--no-flash", action="store_true", help="Sirf serial config")
    p.add_argument("--no-reset", action="store_true", help="Factory reset skip")
    p.add_argument("--ap-name", default="auto", help="AP SSID (auto = MAC se)")
    p.add_argument("--ap-pass", default=DEFAULT_AP_PASS)
    p.add_argument("--admin-user", default=DEFAULT_ADMIN_USER)
    p.add_argument("--admin-pass", default=DEFAULT_ADMIN_PASS)
    p.add_argument("--switch", default=DEFAULT_SWITCH, choices=["momentary", "toggle"])
    p.add_argument("--ota-url", default="")
    p.add_argument("--server-url", default="")
    p.add_argument("--api-key", default="")
    p.add_argument("--list-ports", action="store_true")
    return p.parse_args(argv)


def interactive(args):
    print("=== Robosphere Provisioning Wizard ===")
    print()
    if not args.port:
        args.port = input("Serial port (Enter = auto-detect): ").strip() or None
    if not args.port:
        args.port = auto_port()
    print("Port: %s" % args.port)
    ans = input("AP name (Enter = auto from MAC, e.g. Robosphere-XXXX): ").strip()
    if ans:
        args.ap_name = ans
    ans = input("AP password [%s]: " % args.ap_pass).strip()
    if ans:
        args.ap_pass = ans
    ans = input("Admin username [%s]: " % args.admin_user).strip()
    if ans:
        args.admin_user = ans
    ans = input("Admin password [%s]: " % args.admin_pass).strip()
    if ans:
        args.admin_pass = ans
    ans = input("Switch mode [%s] (momentary/toggle): " % args.switch).strip().lower()
    if ans in ("momentary", "toggle"):
        args.switch = ans
    ans = input("OTA URL (Enter = skip): ").strip()
    if ans:
        args.ota_url = ans
    ans = input("Server URL (Enter = skip): ").strip()
    if ans:
        args.server_url = ans
    if args.server_url:
        args.api_key = input("API key: ").strip()
    print()


def main():
    args = parse_args(sys.argv[1:])
    if args.list_ports:
        list_ports()
        return

    # Interactive wizard sirf tab jab koi flag nahi diya
    if len(sys.argv) == 1:
        interactive(args)

    if not args.port:
        try:
            args.port = auto_port()
            print("Port auto-detect: %s" % args.port)
        except ProvisionError as e:
            print("ERROR: %s" % e)
            sys.exit(1)

    try:
        provision(args)
    except (ProvisionError, subprocess.TimeoutExpired) as e:
        print("\n❌ PROVISION FAILED: %s" % e)
        sys.exit(1)
    except serial.SerialException as e:
        print("\n❌ SERIAL ERROR: %s" % e)
        sys.exit(1)


if __name__ == "__main__":
    main()
