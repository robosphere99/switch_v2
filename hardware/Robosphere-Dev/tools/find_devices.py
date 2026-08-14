#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
find_devices.py - Robosphere IoT ESP32 devices ko LAN pe automatically
dhoondho aur platformio.ini ke OTA envs ki IP update karo.

Usage:
  python tools/find_devices.py              # sirf scan + report (kuch change nahi)
  python tools/find_devices.py --update     # scan + platformio.ini update
  python tools/find_devices.py --map        # UNKNOWN device ko interactively map karo

Kaise kaam karta hai:
  1. Subnet scan (port 80) + ARP table - dono se candidates
  2. Jo bhi "Robosphere" page serve kare wo hamara device
  3. Har device ka MAC `arp -a` se milta hai
  4. `.device_map.json` (MAC -> env name) se pata chalta hai kaunsa device hai
  5. --update pe platformio.ini ke us env ki upload_port update ho jaati hai

Naya device aaye toh bas .device_map.json mein MAC: "env-name" add karo
(MAC script ki report mein milta hai) - ya `--map` use karo.
"""

import argparse
import ipaddress
import json
import os
import re
import socket
import subprocess
import sys
import threading
import urllib.request

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PIO_INI = os.path.join(PROJECT_ROOT, "platformio.ini")
DEVICE_MAP = os.path.join(PROJECT_ROOT, ".device_map.json")
FINGERPRINT = "Robosphere"
MAX_THREADS = 64


def get_local_ip():
    """Default route interface ka IPv4 nikal lo (Windows/macOS/Linux sab pe chalega)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def port_open(ip, port=80, timeout=1.0):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    try:
        return s.connect_ex((ip, port)) == 0
    except OSError:
        return False
    finally:
        s.close()


def fetch_body(ip, timeout=3.0):
    """GET / (login pe redirect hota hai) - body return karo, fail pe ''."""
    try:
        req = urllib.request.Request(
            "http://%s/" % ip, headers={"User-Agent": "robosphere-find"}
        )
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read(20000).decode("utf-8", "replace")
    except Exception:
        return ""


def get_arp_macs():
    """`arp -a` parse karo -> {ip: mac} (lowercase, colon format)."""
    macs = {}
    try:
        out = subprocess.run(
            ["arp", "-a"], capture_output=True, text=True, timeout=10
        ).stdout
        pat = re.compile(
            r"(\d+\.\d+\.\d+\.\d+)\s+"
            r"([0-9a-fA-F]{2}(?:-[0-9a-fA-F]{2}){5})"
        )
        for m in pat.finditer(out):
            macs[m.group(1)] = m.group(2).replace("-", ":").lower()
    except Exception:
        pass
    return macs


def scan_subnet(local_ip):
    """Robosphere devices dhoondo - port scan + ARP table dono use karo
    (taaki koi bhi device miss na ho)."""
    hosts = [str(h) for h in ipaddress.ip_network(
        "%s/24" % local_ip, strict=False).hosts()]
    open_ips = []
    lock = threading.Lock()
    sem = threading.Semaphore(MAX_THREADS)

    def worker(ip):
        with sem:
            if port_open(ip):
                with lock:
                    open_ips.append(ip)

    threads = [threading.Thread(target=worker, args=(ip,)) for ip in hosts]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    # ARP table se bhi candidates lo (port scan miss kar de toh bhi mil jayega)
    arp_ips = [ip for ip in get_arp_macs() if ip != local_ip]

    candidates = sorted(set(open_ips) | set(arp_ips),
                        key=lambda ip: int(ip.split(".")[-1]))

    found = []
    for ip in candidates:
        if FINGERPRINT in fetch_body(ip):
            found.append(ip)

    # ARP warm-up (MAC pakka lene ke liye) - sirf found IPs pe
    for ip in found:
        subprocess.run(["ping", "-n", "1", "-w", "1500", ip],
                       capture_output=True, timeout=5)
    return sorted(found, key=lambda ip: int(ip.split(".")[-1]))


def load_device_map():
    if os.path.exists(DEVICE_MAP):
        try:
            with open(DEVICE_MAP, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_device_map(mapping):
    with open(DEVICE_MAP, "w", encoding="utf-8") as f:
        json.dump(mapping, f, indent=2)
        f.write("\n")


def update_pio_ini(env_ips):
    """Har found env ki upload_port (IP) platformio.ini mein update karo.
    Returns: list of change descriptions (empty = kuch nahi badla)."""
    with open(PIO_INI, encoding="utf-8", newline="") as f:
        lines = f.readlines()

    changed = []
    current_section = None
    for i, line in enumerate(lines):
        m = re.match(r"\[\s*env:([^\]]+)\s*\]", line)
        if m:
            current_section = m.group(1)
            continue
        if current_section and current_section in env_ips:
            m2 = re.match(
                r"^(\s*upload_port\s*=\s*)(\d+\.\d+\.\d+\.\d+)(\s*)$", line
            )
            if m2:
                new_ip = env_ips[current_section]
                if m2.group(2) != new_ip:
                    lines[i] = m2.group(1) + new_ip + m2.group(3) + "\n"
                    changed.append("%s: %s -> %s"
                                   % (current_section, m2.group(2), new_ip))

    if changed:
        with open(PIO_INI, "w", encoding="utf-8", newline="") as f:
            f.writelines(lines)
    return changed


def list_envs():
    """platformio.ini ke saare env names (jo OTA hain unka suffix -ota)."""
    envs = []
    try:
        with open(PIO_INI, encoding="utf-8", newline="") as f:
            for line in f:
                m = re.match(r"\[\s*env:([^\]]+)\s*\]", line)
                if m:
                    envs.append(m.group(1))
    except Exception:
        pass
    return envs


def main():
    ap = argparse.ArgumentParser(
        description="Robosphere devices scan + platformio.ini IP update")
    ap.add_argument("--update", action="store_true",
                    help="platformio.ini ke OTA envs ki IP found devices se update karo")
    ap.add_argument("--map", action="store_true",
                    help="UNKNOWN devices ko interactively .device_map.json mein map karo")
    args = ap.parse_args()

    local = get_local_ip()
    if not local:
        sys.exit("ERROR: Local IP nahi mila - network connected hai?")
    print("Local IP: %s  ->  scanning %s/24 ..." % (local, local))

    found = scan_subnet(local)
    macs = get_arp_macs()
    mapping = load_device_map()
    envs = list_envs()

    if not found:
        print("\nKoi Robosphere device nahi mila.")
        print("Tip: devices isi WiFi pe aur on hain?")
        return

    print("\nFound %d Robosphere device(s):" % len(found))
    env_ips = {}
    unknowns = []
    for ip in found:
        mac = macs.get(ip, "?")
        env = mapping.get(mac)
        if env:
            env_ips[env] = ip
            print("  %s   MAC %s   -> %s" % (ip, mac, env))
        else:
            unknowns.append((ip, mac))
            print("  %s   MAC %s   -> UNKNOWN (naya device?)" % (ip, mac))

    # --- --map: unknown devices ko assign karo ---
    if args.map and unknowns:
        print("\n--- Assign UNKNOWN devices (empty = skip) ---")
        print("Available envs: %s" % ", ".join(envs))
        for ip, mac in unknowns:
            if mac == "?":
                print("  %s: MAC nahi mila (ARP mein nahi) - skip" % ip)
                continue
            ans = input("  %s (MAC %s) ka env name: " % (ip, mac)).strip()
            if ans:
                mapping[mac] = ans
                env_ips[ans] = ip
                print("  Mapped: %s -> %s" % (mac, ans))
        if mapping != load_device_map():
            save_device_map(mapping)
            print("\n.device_map.json updated.")
            return

    if args.update:
        if not env_ips:
            print("\nKoi mapped device nahi mila - platformio.ini update nahi hua.")
            print("UNKNOWN device ko map karo: python tools/find_devices.py --map")
            return
        changed = update_pio_ini(env_ips)
        if changed:
            print("\nplatformio.ini updated:")
            for c in changed:
                print("  %s" % c)
        else:
            print("\nplatformio.ini already up-to-date (koi change nahi).")
    elif not (args.map and unknowns):
        print("\nTip: platformio.ini update karne ke liye: "
              "python tools/find_devices.py --update")


if __name__ == "__main__":
    main()
