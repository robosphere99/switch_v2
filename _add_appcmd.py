import io

P = r"C:\Users\robos\OneDrive\Documents\SwitchNest\site\apps\api\src\routes\admin.routes.ts"
src = io.open(P, encoding="utf-8").read()

# 1) extend type
old_type = "    webconfig: {\n"
new_type = ("    appPool: string | null;\n"
            "    wpEvents: string | null;\n"
            "    webconfig: {\n")
assert old_type in src, "type anchor missing"
src = src.replace(old_type, new_type, 1)

# 2) init
old_init = "    webconfig: null,\n  };"
new_init = "    webconfig: null,\n    appPool: null,\n    wpEvents: null,\n  };"
assert old_init in src, "init anchor missing"
src = src.replace(old_init, new_init, 1)

# 3) add appcmd + wevtutil probe before the parent probe block
anchor = "  // Parent process — w3wp (app-pool worker) stable hai ya khud recycle"
assert anchor in src, "parent anchor missing"
probe = (
    "  // App pool config — har 60s recycle ka reason yahan milta hai\n"
    "  // (recycling.periodicRestart, cpu/memory limits, idle timeout).\n"
    "  // App pool identity read-only appcmd access rakhta hai aksar.\n"
    "  const windir = process.env.windir || \"C:\\\\Windows\";\n"
    "  try {\n"
    "    const out = execSync(\n"
    "      `\\\"${windir}\\\\System32\\\\inetsrv\\\\appcmd.exe\\\" list apppool /config`,\n"
    "      { encoding: \"utf8\", windowsHide: true, timeout: 15_000 },\n"
    "    );\n"
    "    result.appPool = out.slice(0, 5000);\n"
    "  } catch (err) {\n"
    "    result.appPool = `appcmd unavailable: ${err instanceof Error ? err.message : String(err)}`.slice(0, 500);\n"
    "  }\n"
    "  // IIS worker process events (recycling reasons) — best effort, admin\n"
    "  // chahiye hota hai, agar permission na ho to null rehta hai.\n"
    "  try {\n"
    "    const out = execSync(\n"
    "      `\\\"${windir}\\\\System32\\\\wevtutil.exe\\\" qe Microsoft-Windows-IIS-W3SVC-WP/Operational /c:8 /rd:true /f:text`,\n"
    "      { encoding: \"utf8\", windowsHide: true, timeout: 15_000 },\n"
    "    );\n"
    "    result.wpEvents = out.slice(0, 4000);\n"
    "  } catch {\n"
    "    /* no permission — skip */\n"
    "  }\n"
    "\n"
)
src = src.replace(anchor, probe + anchor, 1)

io.open(P, "w", encoding="utf-8", newline="\n").write(src)
print("OK — appcmd probe added")
