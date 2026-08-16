import io, sys

P = r"C:\Users\robos\OneDrive\Documents\SwitchNest\site\apps\api\src\routes\admin.routes.ts"
src = io.open(P, encoding="utf-8").read()

# 1) extend the result type
old_type = "    hbSummary: Array<{ pid: number; count: number; firstUptime: number; lastUptime: number; firstRss: number; lastRss: number; rssGrowthPerHour: number }>;\n  } = {"
new_type = ("    hbSummary: Array<{ pid: number; count: number; firstUptime: number; lastUptime: number; firstRss: number; lastRss: number; rssGrowthPerHour: number }>;\n"
            "    webconfig: {\n"
            "      path: string | null;\n"
            "      iisnode: string | null;\n"
            "      httpErrors: string | null;\n"
            "      appPoolRecycling: string | null;\n"
            "      error?: string;\n"
            "    } | null;\n"
            "  } = {")
assert old_type in src, "type block not found"
src = src.replace(old_type, new_type, 1)

# 2) init the field
old_init = "    hbSummary: [],\n  };"
new_init = "    hbSummary: [],\n    webconfig: null,\n  };"
assert old_init in src, "init block not found"
src = src.replace(old_init, new_init, 1)

# 3) add the webconfig reading logic before `ok(res, result);\n});\n\nadminRouter.get("/logs"`
old_ok = "  ok(res, result);\n});\n\nadminRouter.get(\"/logs\", async (_req, res) => {"
assert old_ok in src, "ok block not found"
wc_block = (
    "\n  // web.config \u2014 iisnode settings (nodeProcessCountPerApplication, watchedFiles,\n"
    "  // maxConcurrentRequestsPerProcess). Process har ~60s recycle ho raha hai bina\n"
    "  // exit line ke \u2014 in settings se asli wajah samajh aayegi.\n"
    "  for (const cand of [\n"
    "    path.resolve(process.cwd(), \"web.config\"),\n"
    "    path.resolve(process.cwd(), \"../web.config\"),\n"
    "    path.resolve(process.cwd(), \"../../web.config\"),\n"
    "  ]) {\n"
    "    if (!fs.existsSync(cand)) continue;\n"
    "    try {\n"
    "      const content = fs.readFileSync(cand, \"utf8\");\n"
    "      const grab = (re: RegExp) => {\n"
    "        const m = re.exec(content);\n"
    "        return m ? m[0].slice(0, 500) : null;\n"
    "      };\n"
    "      result.webconfig = {\n"
    "        path: cand,\n"
    "        iisnode: grab(/<iisnode\\b[^>]*>/i),\n"
    "        httpErrors: grab(/<httpErrors\\b[^>]*>/i),\n"
    "        appPoolRecycling: grab(/<recycling\\b[\\s\\S]*?<\\/recycling>/i)?.slice(0, 400) ?? null,\n"
    "      };\n"
    "      break;\n"
    "    } catch (err) {\n"
    "      result.webconfig = {\n"
    "        path: cand,\n"
    "        iisnode: null,\n"
    "        httpErrors: null,\n"
    "        appPoolRecycling: null,\n"
    "        error: err instanceof Error ? err.message : String(err),\n"
    "      };\n"
    "      break;\n"
    "    }\n"
    "  }\n"
    "\n"
)
src = src.replace(old_ok, wc_block + old_ok, 1)

io.open(P, "w", encoding="utf-8", newline="\n").write(src)
print("OK — webconfig block added")
