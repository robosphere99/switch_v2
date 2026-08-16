import io

P = r"C:\Users\robos\OneDrive\Documents\SwitchNest\site\apps\api\src\routes\admin.routes.ts"
src = io.open(P, encoding="utf-8").read()

# 1) extend type: add parent field after process block
old_type = "    boot: string[];\n    exits: string[];\n    crashes: string[];\n    serverErrors: string[];"
new_type = ("    parent: {\n"
            "      pid: number;\n"
            "      name: string;\n"
            "      startTime: string;\n"
            "      cmdline: string;\n"
            "    } | null;\n"
            "    boot: string[];\n"
            "    exits: string[];\n"
            "    crashes: string[];\n"
            "    serverErrors: string[];")
assert old_type in src, "type block not found"
src = src.replace(old_type, new_type, 1)

# 2) init
old_init = "    boot: [],\n    exits: [],"
new_init = "    parent: null,\n    boot: [],\n    exits: [],"
assert old_init in src, "init block not found"
src = src.replace(old_init, new_init, 1)

# 3) add probe code right after the webconfig loop block, before ok(res, result)
anchor = "  ok(res, result);\n});\n\nadminRouter.get(\"/logs\", async (_req, res) => {"
assert anchor in src, "anchor not found"
probe = (
    "\n  // Parent process — w3wp (app-pool worker) stable hai ya khud recycle\n"
    "  // ho raha hai? Agar w3wp bhi har minute naya hai to pool-level recycle\n"
    "  // (Plesk config). Agar w3wp purana hai to iisnode node ko khud maarta hai.\n"
    "  try {\n"
    "    const wm = (cmd: string) => execSync(cmd, { encoding: \"utf8\", windowsHide: true, timeout: 10_000 });\n"
    "    const out = wm(`wmic process where ProcessId=${process.pid} get ParentProcessId /value`);\n"
    "    const m = /ParentProcessId=(\\d+)/.exec(out);\n"
    "    if (m) {\n"
    "      const ppid = Number(m[1]);\n"
    "      const p2 = wm(`wmic process where ProcessId=${ppid} get Name,CreationDate,CommandLine /value`);\n"
    "      result.parent = {\n"
    "        pid: ppid,\n"
    "        name: /Name=(.*)/.exec(p2)?.[1] ?? \"\",\n"
    "        startTime: /CreationDate=(.*)/.exec(p2)?.[1] ?? \"\",\n"
    "        cmdline: (/CommandLine=(.*)/.exec(p2)?.[1] ?? \"\").slice(0, 300),\n"
    "      };\n"
    "    }\n"
    "  } catch {\n"
    "    /* wmic unavailable — parent unknown, koi baat nahi */\n"
    "  }\n"
    "\n"
)
src = src.replace(anchor, probe + anchor, 1)

# 4) ensure execSync import exists
if "execSync" not in src:
    old_imp = "import { execFileSync } from \"node:child_process\";"
    if old_imp in src:
        src = src.replace(old_imp, 'import { execFileSync, execSync } from "node:child_process";', 1)
    else:
        # fallback: add import near top if child_process import in another form
        import re
        m = re.search(r'import\s*\{[^}]*\}\s*from\s*"node:child_process";', src)
        if m:
            src = src.replace(m.group(0), m.group(0).replace("}", ", execSync }", 1) if "execSync" not in m.group(0) else m.group(0), 1)
        else:
            src = src.replace('import fs from "node:fs";', 'import fs from "node:fs";\nimport { execSync } from "node:child_process";', 1)

io.open(P, "w", encoding="utf-8", newline="\n").write(src)
print("OK — parent probe added")
