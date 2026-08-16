import io, re

P = r"C:\Users\robos\OneDrive\Documents\SwitchNest\site\deploy.cmd"
raw = io.open(P, "rb").read()

# normalize: strip stray CRs, then rebuild clean CRLF
txt = raw.decode("utf-8", errors="replace")
txt = txt.replace("\r\n", "\n").replace("\r", "\n")
lines = txt.split("\n")
out = []
for l in lines:
    if "appcmd list apppool" in l or "appcmd list wp" in l:
        # replace bare appcmd with full path form (handled below by rewrite)
        continue
    out.append(l)

# rebuild with the full-path appcmd block
block = [
    'set APPCMD=%windir%\\System32\\inetsrv\\appcmd.exe',
    'call "%APPCMD%" list apppool /config > "%~dp0apps\\logs\\apppool.log" 2>&1',
    'call "%APPCMD%" list wp /config >> "%~dp0apps\\logs\\apppool.log" 2>&1',
]
result = []
for l in out:
    result.append(l)
    if l.strip() == "REM 1b) App pool config dump — har 60s recycle investigation. App pool":
        pass
final = []
i = 0
while i < len(result):
    l = result[i]
    final.append(l)
    # after the comment block about appcmd, the old 'call appcmd' lines were removed;
    # insert the new block right after the comment lines end
    if l.strip() == "REM     sakta hai. Best-effort — fail ho to error text hi milta hai.":
        final.extend(block)
    i += 1

body = "\n".join(final) + "\n"
io.open(P, "wb").write(body.replace("\n", "\r\n").encode("utf-8"))
print("OK — deploy.cmd rewritten clean, full appcmd path")
