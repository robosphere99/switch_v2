#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Robosphere Factory Provisioning — GUI (polished dark UI)
========================================================
provision.py ka wahi logic, ek professional dark interface:
rounded cards/fields/buttons, custom checkboxes, styled dropdown,
live colored log + status bar.

Usage:
  python tools/provision_gui.py
"""

import argparse
import os
import queue
import sys
import threading
import tkinter as tk
from tkinter import font as tkfont
from tkinter import ttk, messagebox

# provision.py ko same directory se import karo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import provision  # noqa: E402

# ------------------------------------------------------------
# Theme (dark)
# ------------------------------------------------------------
BG         = "#14161f"   # window
PANEL      = "#1d2130"   # section cards
PANEL_ALT  = "#242a3d"
FG         = "#e8eaf2"
MUTED      = "#8b90a8"
ACCENT     = "#7c5cff"   # brand purple
ACCENT_HI  = "#8f74ff"
ACCENT_DIM = "#4b3f8f"
GREEN      = "#3ddc84"
RED        = "#ff6b6b"
AMBER      = "#ffc857"
BLUE       = "#5aa9ff"
LOG_BG     = "#10131c"
FIELD_BG   = "#262b3d"
FIELD_FG   = "#e8eaf2"
BORDER     = "#363d56"

UNITS_MARKER = "\x00UNITS_DONE\x00"


class QueueWriter:
    """sys.stdout/stderr ko queue mein redirect — GUI thread safely padhe."""

    def __init__(self, q):
        self.q = q

    def write(self, s):
        if s:
            self.q.put(s)

    def flush(self):
        pass


def _log_color(line):
    """Log line ki pehchaan se color tag decide karo."""
    l = line.lower()
    if any(k in l for k in ("fail", "err", "❌", "timeout", "nhi hua", "error")):
        return "err"
    if any(k in l for k in ("✅", "[ok]", "success", "done", "connected", "complete")):
        return "ok"
    if l.startswith("[") and "]" in l[:8] and "/" in l[:8]:
        return "step"
    if any(k in l for k in ("cmd>", "ap ssid", "mac", "ip :", "ssid", "label")):
        return "info"
    if l.startswith("==="):
        return "title"
    return "plain"


# ------------------------------------------------------------
# Custom rounded widgets
# ------------------------------------------------------------
class RoundedBox(tk.Frame):
    """Rounded container. Content ko .inner pe daalo.

    Shell (bg) ke andar ek fill-colored frame + 4 corner patches (chhote
    canvases) jo corners ko arc se 'cut' karte hain — asli rounded corners.
    """
    def __init__(self, master, fill=PANEL, radius=12, bg=BG):
        super().__init__(master, bg=bg)
        self.radius = radius
        self.inner = tk.Frame(self, bg=fill)
        self.inner.pack(fill="both", expand=True)

        r = radius
        # (place kwargs, oval bbox) per corner — har corner ka arc uske
        # inner corner pe centered hai, radius = r
        corners = (
            (dict(x=0, y=0),                       (0, 0, 2 * r, 2 * r)),   # top-left
            (dict(relx=1.0, x=-r, y=0),            (-r, 0, r, 2 * r)),     # top-right
            (dict(x=0, rely=1.0, y=-r),            (0, -r, 2 * r, r)),     # bottom-left
            (dict(relx=1.0, x=-r, rely=1.0, y=-r), (-r, -r, r, r)),       # bottom-right
        )
        for kw, bbox in corners:
            p = tk.Canvas(self, width=r, height=r, bg=bg,
                          highlightthickness=0, bd=0)
            p.create_oval(*bbox, fill=fill, outline="")
            p.place(**kw)


class RoundedButton(tk.Canvas):
    """Canvas-based rounded button (hover + disabled states)."""

    def __init__(self, master, text, command=None, fill=ACCENT, hover=ACCENT_HI,
                 fg="#ffffff", font=("Segoe UI", 11, "bold"), radius=12,
                 padx=22, pady=9, disabled_fill="#2c3042", disabled_fg="#6a7088",
                 bg=BG):
        f = tkfont.Font(font=font)
        w = f.measure(text) + padx * 2
        h = f.metrics("linespace") + pady * 2 + 2
        super().__init__(master, width=w, height=h, bg=bg,
                         highlightthickness=0, bd=0, cursor="hand2")
        self._text = text
        self._command = command
        self._fill = fill
        self._hover = hover
        self._fg = fg
        self._font = font
        self._radius = radius
        self._disabled_fill = disabled_fill
        self._disabled_fg = disabled_fg
        self._enabled = True
        self._state = "normal"
        self.bind("<Configure>", lambda e: self._draw())
        self.bind("<Enter>", lambda e: self._draw(hover=True))
        self.bind("<Leave>", lambda e: self._draw(hover=False))
        self.bind("<Button-1>", self._click)
        self._draw()

    def _click(self, _e):
        if self._enabled and self._command:
            self._command()

    def configure(self, state=None, **kw):
        if state is not None:
            self._enabled = state != "disabled"
            self._state = state
        for k, v in kw.items():
            setattr(self, "_" + k, v)
        self._draw()
        return self

    def cget(self, key):
        if key == "state":
            return self._state
        return getattr(self, "_" + key, None)

    def _draw(self, hover=False):
        self.delete("all")
        w, h = self.winfo_width(), self.winfo_height()
        if w < 10 or h < 10:
            w, h = int(self["width"]), int(self["height"])
        r = self._radius
        if not self._enabled:
            fill, fg = self._disabled_fill, self._disabled_fg
        elif hover:
            fill, fg = self._hover, self._fg
        else:
            fill, fg = self._fill, self._fg
        pts = (r, 0, w - r, 0, w, 0, w, r, w, h - r, w, h, w - r, h,
               r, h, 0, h, 0, h - r, 0, r, 0, 0)
        self.create_polygon(pts, smooth=True, fill=fill, outline="")
        self.create_text(w / 2, h / 2 + 1, text=self._text, fill=fg, font=self._font)


class ToggleCheck(tk.Canvas):
    """Rounded custom checkbox (accent fill + white check mark)."""

    def __init__(self, master, text, variable, on_fill=ACCENT, off_fill=FIELD_BG,
                 fg=FG, radius=5, box=18, gap=8, font=("Segoe UI", 10), bg=PANEL):
        f = tkfont.Font(font=font)
        w = f.measure(text) + box + gap + 8
        h = box + 10
        super().__init__(master, width=w, height=h, bg=bg,
                         highlightthickness=0, bd=0, cursor="hand2")
        self._text = text
        self.var = variable
        self._on_fill = on_fill
        self._off_fill = off_fill
        self._fg = fg
        self._radius = radius
        self._box = box
        self._gap = gap
        self._font = font
        self._hover = False
        variable.trace_add("write", lambda *a: self._draw())
        self.bind("<Button-1>", lambda e: self._toggle())
        self.bind("<Enter>", lambda e: (setattr(self, "_hover", True), self._draw()))
        self.bind("<Leave>", lambda e: (setattr(self, "_hover", False), self._draw()))
        self._draw()

    def _toggle(self):
        self.var.set(not self.var.get())

    def _draw(self):
        self.delete("all")
        h = int(self["height"])
        box = self._box
        y0 = (h - box) / 2.0
        on = bool(self.var.get())
        if on:
            fill, outline = self._on_fill, ""
        else:
            fill = ACCENT_DIM if self._hover else self._off_fill
            outline = BORDER
        r = self._radius
        pts = (r, y0, box - r, y0, box, y0, box, y0 + r, box, y0 + box - r,
               box, y0 + box, box - r, y0 + box, r, y0 + box, 0, y0 + box,
               0, y0 + box - r, 0, y0 + r, 0, y0)
        self.create_polygon(pts, smooth=True, fill=fill, outline=outline)
        if on:
            c = y0 + box / 2.0
            self.create_line(4, c, box / 2.0 - 1, y0 + box - 4,
                             fill="#ffffff", width=2,
                             capstyle="round", joinstyle="round")
            self.create_line(box / 2.0 - 1, y0 + box - 4, box - 4, y0 + 4,
                             fill="#ffffff", width=2,
                             capstyle="round", joinstyle="round")
        self.create_text(box + self._gap, h / 2.0 + 1, text=self._text,
                         fill=self._fg, font=self._font, anchor="w")


# ------------------------------------------------------------
# Main app
# ------------------------------------------------------------
class ProvisionApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Robosphere Factory Provisioner")
        self.configure(bg=BG)

        # Window size — screen se chhota rakho taaki LOG hamesha dikhe
        sh = self.winfo_screenheight()
        sw = self.winfo_screenwidth()
        h = max(680, min(880, sh - 120))
        w = 820 if sw >= 900 else 720
        self.geometry("%dx%d" % (w, h))
        self.minsize(680, 660)

        self.log_q = queue.Queue()
        self.worker = None
        self.units_done = 0
        self._placeholder = True

        self._style()
        self._build_ui()
        self.refresh_ports()
        self._set_status("Ready — port select karo", MUTED)

    # ------------------------------------------------------------
    # Style
    # ------------------------------------------------------------
    def _style(self):
        style = ttk.Style(self)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass

        style.configure("TLabel", background=BG, foreground=FG, font=("Segoe UI", 10))
        style.configure("Panel.TLabel", background=PANEL, foreground=FG,
                        font=("Segoe UI", 10))
        style.configure("Muted.TLabel", background=BG, foreground=MUTED,
                        font=("Segoe UI", 9))
        style.configure("Title.TLabel", background=BG, foreground=FG,
                        font=("Segoe UI", 16, "bold"))
        style.configure("Section.TLabel", background=PANEL, foreground=ACCENT_HI,
                        font=("Segoe UI", 9, "bold"))
        style.configure("Legend.TLabel", background=PANEL, foreground=MUTED,
                        font=("Segoe UI", 8))

        # Fields — border invisible (rounded box hi border hai), focus pe
        # thoda lighter (focus ring jaisa)
        style.configure("Field.TEntry",
                        fieldbackground=FIELD_BG, foreground=FIELD_FG,
                        insertcolor=FIELD_FG, bordercolor=FIELD_BG,
                        lightcolor=FIELD_BG, darkcolor=FIELD_BG,
                        padding=(10, 7))
        style.map("Field.TEntry",
                  fieldbackground=[("focus", "#2b3145")])

        style.configure("Field.TCombobox",
                        fieldbackground=FIELD_BG, foreground=FIELD_FG,
                        bordercolor=FIELD_BG, lightcolor=FIELD_BG,
                        darkcolor=FIELD_BG, arrowcolor=MUTED,
                        padding=(10, 6))
        style.map("Field.TCombobox",
                  fieldbackground=[("readonly", FIELD_BG), ("focus", "#2b3145")],
                  arrowcolor=[("active", FG), ("focus", FG)])

        style.configure("Vertical.TScrollbar",
                        background=PANEL_ALT, troughcolor=LOG_BG,
                        bordercolor=LOG_BG, arrowcolor=MUTED, relief="flat")

        # Combobox dropdown (popdown list) — dark, accent selection.
        # option_add reliable nahi hai (Tk version pe depend), isliye har
        # combobox ko postcommand se khulte hi style karte hain (robust).
        self.option_add("*TCombobox*Listbox.background", FIELD_BG)
        self.option_add("*TCombobox*Listbox.foreground", FIELD_FG)
        self.option_add("*TCombobox*Listbox.selectBackground", ACCENT)
        self.option_add("*TCombobox*Listbox.selectForeground", "#ffffff")
        self.option_add("*TCombobox*Listbox.font", ("Segoe UI", 10))
        self.option_add("*TCombobox*Listbox.borderWidth", 0)
        self.option_add("*TCombobox*Listbox.highlightThickness", 0)

    # ------------------------------------------------------------
    # UI
    # ------------------------------------------------------------
    def _entry(self, parent, row, col, var, show=None):
        box = RoundedBox(parent, fill=FIELD_BG, radius=9, bg=PANEL)
        box.grid(row=row, column=col, sticky="ew", padx=(0, 12), pady=4)
        e = ttk.Entry(box.inner, textvariable=var, show=show, style="Field.TEntry")
        e.pack(fill="x", expand=True, padx=8, pady=4)
        return box

    def _combo(self, parent, row, col, var, values, state="readonly"):
        box = RoundedBox(parent, fill=FIELD_BG, radius=9, bg=PANEL)
        box.grid(row=row, column=col, sticky="ew", padx=(0, 12), pady=4)
        cb = ttk.Combobox(box.inner, textvariable=var, values=values,
                          state=state, style="Field.TCombobox")
        cb.configure(postcommand=lambda c=cb: self._style_popdown(c))
        cb.pack(fill="x", expand=True, padx=8, pady=4)
        return cb

    def _style_popdown(self, cb):
        """Dropdown khulte hi popdown listbox ko dark + accent style karo."""
        try:
            pop = cb.tk.call("ttk::combobox::PopdownWindow", cb)
            cb.tk.call(pop, "configure", "-background", FIELD_BG)
            lst = pop + ".f.l"
            cb.tk.call(lst, "configure",
                       "-background", FIELD_BG,
                       "-foreground", FIELD_FG,
                       "-selectbackground", ACCENT,
                       "-selectforeground", "#ffffff",
                       "-font", ("Segoe UI", 10),
                       "-borderwidth", 0,
                       "-highlightthickness", 0,
                       "-activestyle", "none")
        except Exception:
            pass

    def _build_ui(self):
        main = tk.Frame(self, bg=BG)
        main.pack(fill="both", expand=True)
        main.columnconfigure(0, weight=1)

        # ---- accent bar + header ----
        tk.Frame(main, bg=ACCENT, height=3).grid(row=0, column=0, sticky="ew")

        header = tk.Frame(main, bg=BG)
        header.grid(row=1, column=0, sticky="ew", padx=18, pady=(10, 2))
        header.columnconfigure(0, weight=1)
        ttk.Label(header, text="⚡  Robosphere Factory Provisioner",
                  style="Title.TLabel").grid(row=0, column=0, sticky="w")
        ttk.Label(header, text="nayi board ko sell-ready banao",
                  style="Muted.TLabel").grid(row=1, column=0, sticky="w", pady=(0, 2))
        ttk.Label(header, text="v2 · factory tool", style="Muted.TLabel").grid(
            row=0, column=1, rowspan=2, sticky="e")

        # ---- DEVICE card ----
        dev = RoundedBox(main, fill=PANEL, radius=12)
        dev.grid(row=2, column=0, sticky="ew", padx=14, pady=(6, 2))
        dev.inner.columnconfigure(1, weight=1)
        dev.inner.columnconfigure(4, weight=1)

        ttk.Label(dev.inner, text="Serial Port", style="Panel.TLabel").grid(
            row=0, column=0, sticky="w", padx=(14, 8), pady=8)
        port_box = RoundedBox(dev.inner, fill=FIELD_BG, radius=9, bg=PANEL)
        port_box.grid(row=0, column=1, sticky="ew", padx=(0, 6), pady=8)
        self.port_var = tk.StringVar()
        self.port_cb = ttk.Combobox(port_box.inner, textvariable=self.port_var,
                                    state="readonly", style="Field.TCombobox")
        self.port_cb.configure(postcommand=lambda c=self.port_cb: self._style_popdown(c))
        self.port_cb.pack(fill="x", expand=True, padx=8, pady=4)

        self.refresh_btn = RoundedButton(dev.inner, text="⟳",
                                         command=self.refresh_ports,
                                         fill=PANEL_ALT, hover="#2e3448", fg=FG,
                                         font=("Segoe UI", 11), radius=9,
                                         padx=10, pady=5, bg=PANEL)
        self.refresh_btn.grid(row=0, column=2, padx=(0, 12), pady=8)

        ttk.Label(dev.inner, text="Env", style="Panel.TLabel").grid(
            row=0, column=3, sticky="w", padx=(12, 8), pady=8)
        env_box = RoundedBox(dev.inner, fill=FIELD_BG, radius=9, bg=PANEL)
        env_box.grid(row=0, column=4, sticky="ew", padx=(0, 12), pady=8)
        self.env_var = tk.StringVar(value="esp32doit-devkit-v1")
        self.env_cb = ttk.Combobox(env_box.inner, textvariable=self.env_var,
                                   values=self._env_list(), state="normal",
                                   style="Field.TCombobox")
        self.env_cb.configure(postcommand=lambda c=self.env_cb: self._style_popdown(c))
        self.env_cb.pack(fill="x", expand=True, padx=8, pady=4)

        # ---- DEFAULTS card (2 columns — compact) ----
        df = RoundedBox(main, fill=PANEL, radius=12)
        df.grid(row=3, column=0, sticky="ew", padx=14, pady=(6, 2))
        df.inner.columnconfigure(1, weight=1)
        df.inner.columnconfigure(3, weight=1)
        df.inner.columnconfigure(0, minsize=104)
        df.inner.columnconfigure(2, minsize=104)

        ttk.Label(df.inner, text="DEFAULTS  ·  naye board pe yeh set hoga",
                  style="Section.TLabel").grid(row=0, column=0, columnspan=4,
                                               sticky="w", padx=14, pady=(10, 2))

        self.ap_name_var = tk.StringVar(value="")
        self.ap_pass_var = tk.StringVar(value=provision.DEFAULT_AP_PASS)
        self.admin_user_var = tk.StringVar(value=provision.DEFAULT_ADMIN_USER)
        self.admin_pass_var = tk.StringVar(value=provision.DEFAULT_ADMIN_PASS)
        self.ota_url_var = tk.StringVar(value="")
        self.server_url_var = tk.StringVar(value="")
        self.api_key_var = tk.StringVar(value="")

        ttk.Label(df.inner, text="AP name (blank=auto)", style="Panel.TLabel").grid(
            row=1, column=0, sticky="w", padx=(14, 8), pady=4)
        self._entry(df.inner, 1, 1, self.ap_name_var)
        ttk.Label(df.inner, text="AP password", style="Panel.TLabel").grid(
            row=1, column=2, sticky="w", padx=(12, 8), pady=4)
        self._entry(df.inner, 1, 3, self.ap_pass_var)

        ttk.Label(df.inner, text="Admin user", style="Panel.TLabel").grid(
            row=2, column=0, sticky="w", padx=(14, 8), pady=4)
        self._entry(df.inner, 2, 1, self.admin_user_var)
        ttk.Label(df.inner, text="Admin pass", style="Panel.TLabel").grid(
            row=2, column=2, sticky="w", padx=(12, 8), pady=4)
        self._entry(df.inner, 2, 3, self.admin_pass_var)

        ttk.Label(df.inner, text="Switch mode", style="Panel.TLabel").grid(
            row=3, column=0, sticky="w", padx=(14, 8), pady=4)
        self.switch_var = tk.StringVar(value="momentary")
        self._combo(df.inner, 3, 1, self.switch_var, ["momentary", "toggle"])
        ttk.Label(df.inner, text="OTA URL (opt.)", style="Panel.TLabel").grid(
            row=3, column=2, sticky="w", padx=(12, 8), pady=4)
        self._entry(df.inner, 3, 3, self.ota_url_var)

        ttk.Label(df.inner, text="Server URL (opt.)", style="Panel.TLabel").grid(
            row=4, column=0, sticky="w", padx=(14, 8), pady=4)
        self._entry(df.inner, 4, 1, self.server_url_var)
        ttk.Label(df.inner, text="API key (opt.)", style="Panel.TLabel").grid(
            row=4, column=2, sticky="w", padx=(12, 8), pady=4)
        self._entry(df.inner, 4, 3, self.api_key_var)

        # ---- OPTIONS card ----
        op = RoundedBox(main, fill=PANEL, radius=12)
        op.grid(row=4, column=0, sticky="ew", padx=14, pady=(6, 2))
        op_row = tk.Frame(op.inner, bg=PANEL)
        op_row.pack(fill="x", padx=10, pady=(6, 10))
        self.flash_var = tk.BooleanVar(value=True)
        self.reset_var = tk.BooleanVar(value=True)
        self.build_var = tk.BooleanVar(value=False)
        for txt, var in (("Flash firmware", self.flash_var),
                         ("Factory reset (clean NVS)", self.reset_var),
                         ("Build first", self.build_var)):
            ToggleCheck(op_row, txt, var, bg=PANEL).pack(side="left", padx=(4, 14))

        # ---- PROVISION ----
        btn_row = tk.Frame(main, bg=BG)
        btn_row.grid(row=5, column=0, sticky="ew", padx=14, pady=(8, 2))
        btn_row.columnconfigure(0, weight=1)
        self.prov_btn = RoundedButton(btn_row, text="   PROVISION   ",
                                      command=self.on_provision)
        self.prov_btn.grid(row=0, column=0, sticky="ew")
        self.units_label = ttk.Label(btn_row, text="Boards ready: 0",
                                     style="Muted.TLabel")
        self.units_label.grid(row=0, column=1, sticky="e", padx=(10, 2))

        # ---- LOG (hamesha visible — expand + minsize) ----
        log_card = RoundedBox(main, fill=PANEL, radius=12)
        log_card.grid(row=6, column=0, sticky="nsew", padx=14, pady=(6, 2))
        log_card.inner.columnconfigure(0, weight=1)
        log_card.inner.rowconfigure(1, weight=1)

        log_header = tk.Frame(log_card.inner, bg=PANEL)
        log_header.grid(row=0, column=0, sticky="ew", padx=12, pady=(8, 0))
        ttk.Label(log_header, text="LOG", style="Section.TLabel").pack(side="left")
        legend = tk.Frame(log_header, bg=PANEL)
        legend.pack(side="right")
        for txt, col in (("● Steps", AMBER), ("✓ OK", GREEN),
                         ("✗ Error", RED), ("ℹ Info", BLUE)):
            tk.Label(legend, text=txt, bg=PANEL, fg=col,
                     font=("Segoe UI", 8)).pack(side="left", padx=(0, 8))

        self.log_text = tk.Text(log_card.inner, height=16, wrap="word",
                                font=("Consolas", 10), bg=LOG_BG, fg=FG,
                                insertbackground=FG, relief="flat",
                                highlightbackground=BORDER, highlightthickness=1,
                                padx=10, pady=8, state="disabled")
        scroll = ttk.Scrollbar(log_card.inner, command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=scroll.set)
        scroll.grid(row=1, column=1, sticky="ns", padx=(0, 10), pady=6)
        self.log_text.grid(row=1, column=0, sticky="nsew", padx=(12, 0),
                           pady=(6, 12))

        # ---- Status bar ----
        self.status_var = tk.StringVar(value="")
        status_row = tk.Frame(main, bg=BG)
        status_row.grid(row=7, column=0, sticky="ew", padx=18, pady=(4, 10))
        self.status_dot = tk.Label(status_row, text="●", bg=BG, fg=GREEN,
                                   font=("Segoe UI", 9))
        self.status_dot.pack(side="left")
        self.status_lbl = tk.Label(status_row, textvariable=self.status_var,
                                   bg=BG, fg=MUTED, font=("Segoe UI", 9), anchor="w")
        self.status_lbl.pack(side="left", padx=(6, 0), fill="x", expand=True)

        # Log row ko hamesha jagah do (kabhi collapse na ho)
        main.rowconfigure(6, weight=1, minsize=200)

        # Enter = provision
        self.bind("<Return>", lambda e: self.on_provision())

        self._tag_config()
        self.log_text.configure(state="normal")
        self.log_text.insert("1.0",
                             "  ▶  PROVISION dabao — live output yahan stream hoga\n",
                             ("ph",))
        self.log_text.configure(state="disabled")
        self.after(100, self._poll_log)

    @staticmethod
    def _env_list():
        return ["esp32doit-devkit-v1", "esp32doit-devkit2",
                "esp32-ota", "esp32doit-devkit2-ota"]

    # ------------------------------------------------------------
    # Actions
    # ------------------------------------------------------------
    def refresh_ports(self):
        try:
            import serial.tools.list_ports
            ports = [p.device for p in serial.tools.list_ports.comports()]
        except Exception:
            ports = []
        self.port_cb["values"] = ports
        if ports and self.port_var.get() not in ports:
            self.port_var.set(ports[0] if len(ports) == 1 else "")
        elif not ports:
            self.port_var.set("")

    def _append_log(self, text, color=None):
        self.log_text.configure(state="normal")
        if self._placeholder:
            self.log_text.delete("1.0", "end")
            self._placeholder = False
        for line in text.splitlines(keepends=True):
            tag = color or _log_color(line)
            self.log_text.insert("end", line, (tag,))
        self.log_text.see("end")
        self.log_text.configure(state="disabled")

    def _tag_config(self):
        for name, col in (("ok", GREEN), ("err", RED), ("step", AMBER),
                          ("info", BLUE), ("title", ACCENT_HI),
                          ("ph", MUTED), ("plain", FG)):
            self.log_text.tag_configure(name, foreground=col)
        self.log_text.tag_configure("title", font=("Consolas", 10, "bold"))

    def _set_status(self, msg, color=MUTED):
        self.status_var.set(msg)
        self.status_dot.configure(fg=color)
        self.status_lbl.configure(fg=color)

    def _poll_log(self):
        try:
            while True:
                item = self.log_q.get_nowait()
                if item == UNITS_MARKER:
                    self.units_label.configure(
                        text="Boards ready: %d" % self.units_done)
                else:
                    self._append_log(item)
        except queue.Empty:
            pass
        if self.worker is not None and not self.worker.is_alive():
            self.worker = None
            self.prov_btn.configure(state="normal")
            self._append_log("\n==== DONE ====\n")
            self._set_status("✅ Provision complete — board sell-ready!", GREEN)
        self.after(100, self._poll_log)

    def on_provision(self):
        if self.worker is not None:
            return

        port = self.port_var.get().strip()
        if not port:
            messagebox.showerror("Error", "COM port select karo\n(⟳ Refresh se ports dikhte hain)")
            return

        args = argparse.Namespace(
            port=port,
            env=self.env_var.get().strip() or "esp32doit-devkit-v1",
            build=self.build_var.get(),
            no_flash=not self.flash_var.get(),
            no_reset=not self.reset_var.get(),
            ap_name=self.ap_name_var.get().strip() or "auto",
            ap_pass=self.ap_pass_var.get().strip() or provision.DEFAULT_AP_PASS,
            admin_user=self.admin_user_var.get().strip() or provision.DEFAULT_ADMIN_USER,
            admin_pass=self.admin_pass_var.get().strip() or provision.DEFAULT_ADMIN_PASS,
            switch=self.switch_var.get().strip() or "momentary",
            ota_url=self.ota_url_var.get().strip(),
            server_url=self.server_url_var.get().strip(),
            api_key=self.api_key_var.get().strip(),
        )

        self.log_text.configure(state="normal")
        self.log_text.delete("1.0", "end")
        self._placeholder = False
        self.log_text.configure(state="disabled")

        self.prov_btn.configure(state="disabled")
        self._set_status("Provisioning %s ..." % port, BLUE)
        self._append_log("=== Provisioning %s (env: %s) ===" % (port, args.env))
        self.worker = threading.Thread(target=self._run, args=(args,), daemon=True)
        self.worker.start()

    def _run(self, args):
        old_out, old_err = sys.stdout, sys.stderr
        try:
            sys.stdout = QueueWriter(self.log_q)
            sys.stderr = QueueWriter(self.log_q)
            provision.provision(args)
            self.units_done += 1
            # deterministic: marker ko queue mein daalo — _poll_log (main
            # thread) counter update karega
            self.log_q.put(UNITS_MARKER)
        except SystemExit as e:
            self.log_q.put("Exited: %s\n" % e)
        except Exception as e:
            self.log_q.put("\nFAILED: %s\n" % e)
        finally:
            sys.stdout, sys.stderr = old_out, old_err


def main():
    try:
        app = ProvisionApp()
    except Exception as e:
        print("GUI start nahi hua: %s" % e)
        sys.exit(1)
    app.mainloop()


if __name__ == "__main__":
    main()
