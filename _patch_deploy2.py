import io

P = r"C:\Users\robos\OneDrive\Documents\SwitchNest\site\deploy.cmd"
src = io.open(P, encoding="utf-8", newline="").read()

old = (
    "call appcmd list apppool /config > \"%~dp0apps\\logs\\apppool.log\" 2>&1\r\n"
    "call appcmd list wp /config >> \"%~dp0apps\\logs\\apppool.log\" 2>&1\r\n"
)
new = (
    'set APPCMD=%windir%\\System32\\inetsrv\\appcmd.exe\r\n'
    'call "%APPCMD%" list apppool /config > "%~dp0apps\\logs\\apppool.log" 2>&1\r\n'
    'call "%APPCMD%" list wp /config >> "%~dp0apps\\logs\\apppool.log" 2>&1\r\n'
)
assert old in src, "appcmd lines not found"
src = src.replace(old, new, 1)

io.open(P, "w", encoding="utf-8", newline="\r\n").write(src)
print("OK — full appcmd path")
