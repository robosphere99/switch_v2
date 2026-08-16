import io

P = r"C:\Users\robos\OneDrive\Documents\SwitchNest\site\deploy.cmd"
src = io.open(P, encoding="utf-8", newline="").read()

anchor = "call node scripts\\patch-webconfig.mjs 2>nul\r\n"
assert anchor in src, "anchor not found"
insert = (
    "\r\n"
    "REM 1b) App pool config dump — har 60s recycle investigation. App pool\r\n"
    "REM     identity ko appcmd read access nahi hota; webhook identity me ho\r\n"
    "REM     sakta hai. Best-effort — fail ho to error text hi milta hai.\r\n"
    "call appcmd list apppool /config > \"%~dp0apps\\logs\\apppool.log\" 2>&1\r\n"
    "call appcmd list wp /config >> \"%~dp0apps\\logs\\apppool.log\" 2>&1\r\n"
)
src = src.replace(anchor, anchor + insert, 1)

io.open(P, "w", encoding="utf-8", newline="\r\n").write(src)
print("OK — appcmd dump added to deploy.cmd")
