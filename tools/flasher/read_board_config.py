#!/usr/bin/env python3
"""Temporary helper: read the physical ESP's config over serial (export cmd)."""
import sys
import time

import serial

PORT = sys.argv[1] if len(sys.argv) > 1 else "COM8"
BAUD = 115200

ser = serial.Serial(PORT, BAUD, timeout=0.3)
ser.reset_input_buffer()
time.sleep(0.5)

# Drain anything the board is printing right now.
drained = b""
deadline = time.time() + 1.5
while time.time() < deadline:
    chunk = ser.read(256)
    if chunk:
        drained += chunk
if drained:
    print("=== pre-command output ===")
    print(drained.decode(errors="replace"))

print("\n=== sending: export ===")
ser.write(b"export\n")
buf = b""
deadline = time.time() + 8
while time.time() < deadline:
    chunk = ser.read(256)
    if chunk:
        buf += chunk
        if b"CONFIG EXPORT END" in buf:
            break
print("=== board reply ===")
print(buf.decode(errors="replace"))
ser.close()
