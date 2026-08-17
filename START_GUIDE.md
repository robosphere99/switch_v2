# 🚀 SwitchNest — Fresh Setup + Start Guide

Windows + XAMPP (MySQL/MariaDB) setup. **4 cheezein chahiye** — MySQL, Site (API + Web), Hardware (PlatformIO), Flasher (Python GUI).

- **Repo location:** `C:\Users\robos\OneDrive\Documents\SwitchNest`
- **GitHub:** `robosphere99/switch_v2` — `dev` → CI → `main` → webhook → Plesk auto-deploy (`onlineswitch.bhartitechnical.com`)

---

## 0️⃣ Requirements (pehli baar check karo)

| Cheez | Version | Check command |
|-------|---------|---------------|
| Node.js | 22+ (CI bhi 22) | `node -v` |
| npm | saath me aata hai | `npm -v` |
| Python | 3.10+ | `python --version` |
| PlatformIO Core | latest | `/c/Users/robos/.platformio/penv/Scripts/pio.exe --version` |
| MySQL / XAMPP | MariaDB 10.4 | `netstat -ano \| grep ":3306"` |

> PlatformIO `pio` PATH me nahi hai — hamesha full path se chalao:
> `/c/Users/robos/.platformio/penv/Scripts/pio.exe`

---

## 1️⃣ MySQL start karo (XAMPP MariaDB)

**Option A — XAMPP Control Panel (recommended):**
```
XAMPP Control Panel → MySQL → Start
```

**Option B — command se:**
```bash
cmd //c "start /b C:\xampp\mysql\bin\mysqld.exe --defaults-file=C:\xampp\mysql\bin\my.ini"
```
Check: `netstat -ano | grep ":3306"` → `LISTENING` dikhe to OK

> ⚠️ **Agar MySQL crash kare ("Missing MLOG_CHECKPOINT" / "Incorrect file format" / DESCRIBE pe crash):**
> ```bash
> # 1. InnoDB redo logs corrupt — nikal ke recreate:
> cd /c/xampp/mysql/data
> mv ib_logfile0 ib_logfile0.bak && mv ib_logfile1 ib_logfile1.bak
>
> # 2. Aria system tables corrupt (global_priv/db/columns_priv) — repair:
> /c/xampp/mysql/bin/mysql.exe -uroot -e "REPAIR TABLE mysql.global_priv; REPAIR TABLE mysql.db;"
> # columns_priv corrupt ho to uski files nikal ke CREATE TABLE se recreate karo
> # (definition: /c/xampp/mysql/share/mysql_system_tables.sql line 121)
>
> # 3. my.ini me innodb_force_recovery=1 add kiya hai (LSN mismatch ki wajah se)
> #    — abhi ke liye required, baad me dump+rebuild karke hata sakte ho
> ```

---

## 2️⃣ Site setup (pehli baar — SIRF EK BAAR karna hai)

```bash
cd /c/Users/robos/OneDrive/Documents/SwitchNest/site

npm install              # saare workspaces install (web + api + shared) — ~1 min
npm run db:generate      # Prisma client (schema.prisma se generate)
npm run db:migrate       # tables bana (agar DB empty ho — already hai to skip)
```

> **`.env` ki zaroorat NAHI** — code me defaults hain:
> MySQL `root@localhost:3306` / db `switchnest` (`.env` me `DB_NAME=switchnest` set hai; `switch_v2` backup hai) · JWT dev secrets · API port 4000.
> Production/hosting pe hi `.env` (ya Plesk env vars) chahiye — `site/.env.example` dekho.

> ⚠️ **Windows DLL-lock:** `prisma generate` hamesha **dev server chalane SE PEHLE** karo.
> API chal raha ho to `query_engine-windows.dll.node` locked hota hai → `EPERM: rename` error.
> Fix: API band karo → `npm run db:generate` → API dobara start.

---

## 3️⃣ Site run (har baar — 2 terminals)

**Terminal 1 — API (port 4000):**
```bash
cd /c/Users/robos/OneDrive/Documents/SwitchNest/site
npm run dev:api
```
Health check: `curl http://localhost:4000/api/health` → `{"success":true,...}`

**Terminal 2 — Web (port 5173):**
```bash
cd /c/Users/robos/OneDrive/Documents/SwitchNest/site
npm run dev:web
```
Browser: **http://localhost:5173**

> **Ek-click launcher:** `start-dev.bat` (repo root me) double-click karo — MySQL check/start kare, phir API + Web windows ek saath khol de aur browser me site khol de.

> Vite ka proxy `/api` ko 4000 pe bhejta hai — web se sab kuch ek saath chalta hai.

---

## 4️⃣ Hardware — PlatformIO build

```bash
cd /c/Users/robos/OneDrive/Documents/SwitchNest/hardware/Robosphere-Dev

# Sab environments build (2ch, 4ch, 8ch, dimmers, IR...)
/c/Users/robos/.platformio/penv/Scripts/pio.exe run

# Ya sirf ek environment (tez)
/c/Users/robos/.platformio/penv/Scripts/pio.exe run -e model-2ch
/c/Users/robos/.platformio/penv/Scripts/pio.exe run -e esp32doit-devkit-v1
```

**Output:** `.pio/build/<env>/firmware.bin` — ya `firmware.elf` (upload/flash ke liye).

> PlatformIO Core install nahi hai to: `pip install platformio` (ya VSCode → PlatformIO extension).
> Build verify (last test): **9/9 envs SUCCESS** — RAM 16.6% · Flash 86% ✅

---

## 5️⃣ Flasher GUI (Python — factory/manufacturing tool)

```bash
cd /c/Users/robos/OneDrive/Documents/SwitchNest/tools/flasher

# Pehli baar — deps install
pip install -r requirements.txt      # requests + pyserial + esptool

# Deps check (GUI ke bina — fresh env diagnostic / CI)
python flasher_gui.py --check        # sab OK → exit 0 | missing → exit 1 + install cmd

# GUI chalao
python flasher_gui.py
```

> **Auto-check (v1.1+):** startup pe app khud deps check karta hai. Missing ho to
> **crash nahi** — upar yellow banner + **"Install now"** button dikhta hai (ek click
> me pip install kar deta hai), aur bina dep wale features (login/flash/provision)
> friendly message ke saath disable rehte hain. Fresh environment me bhi bina
> crash ke chalta hai.

**Flasher kya karta hai:** admin API login → order fetch (serial/model/WiFi/API key auto-fill) → firmware flash (esptool) → serial provisioning → relay self-test → factory-tested mark → batch mode.

> **Notes:**
> - Flashing ke liye `esptool` bhi chahiye: `pip install esptool`
> - Firmware path: `/firmware/firmware.bin` (admin OTA publish se aata hai)
> - GUI test: window khule aur 6s tak process alive rahe to OK (koi crash nahi)

---

## 🧪 Test kya karna hai

1. **Landing** — AI chat widget (bottom-right 🤖) → "4 lights control karne hain" → 4CH suggest
2. **Contact form** — landing pe scroll karke message bhejo → admin me dekho
3. **Shop → Order** — product add → checkout (demo UPI payment)
4. **Admin** (`admin@robosphere.local`) — Overview/Support/Users, Shop/Orders, Serial Registry, OTA/ESP, Settings
5. **Buyer dashboard** (testbut2) — devices toggle, warranty page `/warranty`
6. **Serial activation** — `/activate?serial=RS-4CH-2TZ2ZW` → claim

---

## 🔑 Test Accounts

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@robosphere.local` | `site/.env` ki `ADMIN_PASSWORD` (default `admin123`; site pe profile se change ho to .env auto-sync hota hai) |
| **Buyer (4CH device wala)** | `testbut2@robosphere.local` | `123456` |
| Demo user | `demo@robosphere.local` | `demo123` |
| OTA demo admin | `ota-demo@robosphere.local` | — |

> Demo buyer ke home me **4 devices ONLINE** hain (ESP board 192.168.1.36 se linked) — dashboard se toggle karke relay physically click hota hai.

---

## ⚠️ Notes

- **DESCRIBE/SHOW COLUMNS** MySQL CLI me crash karta hai (MariaDB 10.4 grant bug) — app isse use nahi karta, bas CLI debugging me dhyan rakhna. `SELECT * FROM table LIMIT 1` use karo.
- ESP board ka `setserver` abhi LAN IP pe hai — production boards pe domain URL daalna hoga.
- Razorpay keys `.env` me daalo → payment real mode; warna demo UPI mode.

---

## 🆕 First-run Installation (hosting pe deploy karne ke liye)

**Env vars** (`site/.env.example` copy karke `.env` banao):
```
DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME   ← hosting pe bas yahi type karo
ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD    ← first admin
JWT_ACCESS_SECRET, JWT_REFRESH_SECRET          ← production me change
CORS_ORIGINS                                   ← apna domain
```

**Kaise chalta hai:** API pehli baar shuru hota hai → DB/tables nahi milte →
**setup mode** me chalta hai → website pe **install wizard** dikhta hai →
user DB + admin details type karta hai → API khud **DB banata hai + tables
create karta hai + admin account + `app_meta.installed=1` flag** → site normal
chalne lagta hai (koi manual SQL nahi).

- Install endpoints: `GET /api/install/status`, `POST /api/install`
- Existing DB upgrade: `app_meta` table + `installed=1` seed karne ke liye:
  ```sql
  CREATE TABLE IF NOT EXISTS app_meta (`key` VARCHAR(64) PRIMARY KEY, `value` VARCHAR(255) NOT NULL, updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3));
  INSERT INTO app_meta (`key`,`value`) VALUES ('installed','1') ON DUPLICATE KEY UPDATE `value`='1';
  ```
- Schema update hone pe `prisma/schema.sql` regenerate karna:
  `cd site/apps/api && npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/schema.sql`

---

## 🚀 Deploy flow (dev → main → production)

```bash
# 1) Kaam dev pe
git checkout dev
git push origin dev            # CI (typecheck + test + build) — koi deploy nahi

# 2) Production pe bhejna ho to:
git checkout main
git pull origin main
git merge dev
git push origin main          # → webhook → Plesk → auto-deploy live
```

**Plesk pe ek baar setup (production):** Plesk → Git → `switch_v2` → Deployment settings:

| Setting | Value |
|---|---|
| Branch | `main` |
| Deployment mode | **Automatic** |
| **Server path** | `\onlineswitch.bhartitechnical.com` (domain root) |
| Enable additional deployment actions | ✅ |
| Deploy actions | `site\deploy.cmd` |

> ⚠️ **Server path gotcha:** `...\site\apps\api` jaise sub-path mat do — repo root wahan
> dump hota hai → double-nesting (`site/apps/api/site/apps/api/...`) → web update hoti hai
> par **API kabhi nahi**. Server path = domain root hona chahiye (repo ka `site/` wahan
> `...\site\` pe land karta hai, jahan app actually chalti hai).
>
> Verify: `GET https://onlineswitch.bhartitechnical.com/api/health` → `data.build` (live code
> version) · Admin → Diagnostics → "LAST CODE UPDATE" card (deploy.json marker).
