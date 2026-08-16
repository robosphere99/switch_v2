import io

P = r"C:\Users\robos\OneDrive\Documents\SwitchNest\site\apps\api\src\routes\admin.routes.ts"
src = io.open(P, encoding="utf-8").read()
old = 'import fs from "node:fs";'
new = 'import fs from "node:fs";\nimport { execSync } from "node:child_process";'
assert old in src, "fs import not found"
src = src.replace(old, new, 1)
io.open(P, "w", encoding="utf-8", newline="\n").write(src)
print("OK — execSync import added")
