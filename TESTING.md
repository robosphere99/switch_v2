# TESTING.md — Site Verification Checklist

Jab bhi leak-monitor / admin password / instance cleanup wale fixes verify karne
hain, yeh checklist follow karo. Har section me **expected result** diya hai —
agar wahi na mile to bug hai.

---

## 0. Pre-requisites

- Site chal rahi hai: Web `http://localhost:5173`, API `http://localhost:4000`
- Health check: `curl http://localhost:4000/api/health` → `"status":"ok"`
- Admin login: `admin@robosphere.local` / `Anil@20552`
  (password Profile pe change karoge to .env auto-sync hoga — yeh wali file
  `site/.env` me `ADMIN_PASSWORD` se milta hai)

---

## 1. Leak Monitor (sabse important fix)

**Background:** PID 4032 ka "+27% in 2.9h" false positive tha — purane
heartbeat format (bina `ts=`) ka timestamp reconstruction trend ulta kar deta
tha. Fix ke baad sirf real `ts=` lines detect hoti hain.

| # | Test | Kaise | Expected |
|---|------|-------|----------|
| 1.1 | Admin pe koi red leak alert na ho | Admin panel kholo — leak badge/chart | Koi "possible leak" red alert nahi |
| 1.2 | Leak state false ho | Admin → Diagnostics → leak card | `leaking: false`, `detail: null` |
| 1.3 | Memory chart flat/stable | Admin → memory chart (1h/6h/24h) | Line settle dikhe, koi sharp +growth trend nahi |
| 1.4 | API se verify | `curl /api/admin/diagnostics` (token ke saath) | `data.leak.leaking === false` |

**Note:** chart me purane (legacy, bina ts=) hours ab nahi dikhte — expected
hai, chart abhi sirf accurate data dikhata hai.

### API token kaise milega (tech verify ke liye)

```bash
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"usernameEmail":"admin@robosphere.local","password":"Anil@20552"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).data.accessToken))")

curl -s http://localhost:4000/api/admin/diagnostics -H "Authorization: Bearer $TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const l=JSON.parse(d).data.leak;console.log('leaking:',l.leaking,'| detail:',l.detail)})"
```

---

## 2. Admin Password Sync (.env)

**Background:** Profile pe password change → DB + `site/.env` (`ADMIN_PASSWORD`)
dono update hote hain. Install wizard, seed, aur launchers same value use
karte hain.

| # | Test | Kaise | Expected |
|---|------|-------|----------|
| 2.1 | Password change karo | Profile → Change password (koi bhi naya) | Success + login naye password se |
| 2.2 | .env sync hua | `grep ADMIN_PASSWORD site/.env` | `ADMIN_PASSWORD=<naya password>` |
| 2.3 | Log me sync message | `grep 'Admin password' site/apps/logs/app.log` | `Admin password changed — .env ADMIN_PASSWORD synced` |
| 2.4 | Wapas restore karo | Dobara Profile → `Anil@20552` | Login wapas `Anil@20552` se + .env bhi sync |

**Warnings:**
- Password change hone pe **saari doosri sessions logout** ho jati hain (by design — token version bump).
- Password test ke baad wapas `Anil@20552` pe restore karna mat bhoolna.

---

## 3. Duplicate Instance Cleanup

**Background:** `start-dev.bat` / `start-api.bat` baar-baar chalane se multiple
node processes bante hain (memory ×N). `fix-api-instances.bat` sirf ek
canonical (port 4000 wala) rakhta hai.

| # | Test | Kaise | Expected |
|---|------|-------|----------|
| 3.1 | Dry-run | `fix-api-instances.bat -DryRun` | "Koi duplicate/stale API instance nahi mila — sab saaf" (jab sab clean ho) |
| 3.2 | Real cleanup | `fix-api-instances.bat` | Canonical PID protected, baaki killed, port 4000 intact |
| 3.3 | Port guard | API chalte waqt `start-api.bat` kholo | Woh turant exit karega — "duplicate instance nahi chalayenge" |
| 3.4 | Site intact | Cleanup ke baad | `http://localhost:4000/api/health` → ok, web load hota hai |

**Verify (manual):**
```bash
# port 4000 ka owner (canonical) — yehi process zinda rehna chahiye
powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort 4000 -State Listen).OwningProcess"
# node processes count — web (3) + api chain (4) = 7, extra nahi
tasklist /FI "IMAGENAME eq node.exe"
```

---

## 4. Regression — Normal Site Flow

Fixes ke baad basic features turant check karo:

- [ ] Login / logout
- [ ] Dashboard — devices list + online status
- [ ] Device toggle (relay ON/OFF) — physically board pe click hua?
- [ ] Schedules page — add/edit/delete schedule
- [ ] Notifications — aati hain
- [ ] Profile — username/email update
- [ ] Admin — stats, users, logs page load
- [ ] `http://localhost:4000/api/health` → ok

---

## 5. Known notes / current behavior

- **Multiple instances kabhi chal rahe hain to**: log me duplicate
  `[hb]` lines + `leak-incidents.jsonl` me interleaved duplicate entries —
  pehle inhe clean karo (`fix-api-instances.bat`), phir check karo.
- **Leak incidents file**: `site/apps/logs/leak-incidents.jsonl` — purani
  history intact rehti hai (delete mat karo, sirf padho).
- **.env committed nahi hota** (gitignored) — password har machine pe apna.
