#!/usr/bin/env python3
"""Temporary: watch the physical ESP on COM8 and log everything to a file."""
import sys
import time

import serial

PORT = sys.argv[1] if len(sys.argv) > 1 else "COM8"
OUT = sys.argv[2] if len(sys.argv) > 2 else "board_watch.log"
DURATION = int(sys.argv[3]) if len(sys.argv) > 3 else 60

ser = serial.Serial(PORT, 115200, timeout=0.3)
ser.reset_input_buffer()

start = time.time()
with open(OUT, "a", encoding="utf-8") as fh:
    fh.write(f"\n===== watch start {time.strftime('%H:%M:%S')} =====\n")
    while time.time() - start < DURATION:
        chunk = ser.read(256)
        if chunk:
            fh.write(chunk.decode(errors="replace"))
            fh.flush()
ser.close()
