# 🚀 RoboSphere v2 — Start Guide (is machine ke liye)

Windows + XAMPP (MySQL/MariaDB) setup. **3 cheezein chahiye** — MySQL, API, Web.

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

## 2️⃣ API server (port 4000)

```bash
cd /c/Users/robos/OneDrive/Documents/onlineswitch-v2/site
npm run dev:api
```
Health check: `curl http://localhost:4000/api/health` → `{"success":true,...}`

---

## 3️⃣ Web server (port 5173)

```bash
cd /c/Users/robos/OneDrive/Documents/onlineswitch-v2/site
npm run dev:web
```
Browser: **http://localhost:5173**

---

## 🔑 Test Accounts

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@robosphere.local` | `admin123` |
| **Buyer (4CH device wala)** | `testbut2@robosphere.local` | `123456` |
| Demo user | `demo@robosphere.local` | `demo123` |
| OTA demo admin | `ota-demo@robosphere.local` | — |

> Demo buyer ke home me **4 devices ONLINE** hain (ESP board 192.168.1.36 se linked) — dashboard se toggle karke relay physically click hota hai.

---

## 🧪 Test kya karna hai

1. **Landing** — AI chat widget (bottom-right 🤖) → "4 lights control karne hain" → 4CH suggest
2. **Contact form** — landing pe scroll karke message bhejo → admin me dekho
3. **Shop → Order** — product add → checkout (demo UPI payment)
4. **Admin** (`admin@robosphere.local`) — Shop/Orders, Serial Registry, Print Stickers, OTA/ESP, Warranty, Contact Messages
5. **Buyer dashboard** (testbut2) — devices toggle, warranty page `/warranty`
6. **Serial activation** — `/activate?serial=RS-4CH-2TZ2ZW` → claim

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
user DB + admin details type karta hai → API khud **DB banata hai + 25 tables
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
