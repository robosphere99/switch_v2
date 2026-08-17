# Ideas Backlog — Future Suggestions (Review Later)

> Yahan wo saare suggestions accumulate hote hain jo sessions ke dauran aaye —
> abhi implement nahi, phase-appropriate waqt pe review karke karenge.
> Har entry: idea + kahan lagana hai (file/phase).

---

## Phase 4 v1.1 — Realtime polish

- **Optimistic toggle** — dashboard me toggle dabate hi instant UI flip + "pending" badge; `command:updated`/`device:updated` pe confirm; fail pe rollback. (`pages/Dashboard.tsx` + `lib/deviceOptimistic.ts`)
- **Admin panel live devices** — admin sockets saare homes me hain; `device:updated`/`esp:updated` pe admin Devices/ESP table realtime refresh (abhi polling pe hai).
- **Realtime indicator** — navbar me "● live" dot jab socket connected ho (`socket:ready` event se) — user ko pata chale ki live updates aa rahe hain.

## Phase 6 — Rooms, Notifications & Analytics

- **Device usage analytics** — `device_logs` se: on-time per device, toggles per day/member, daily trend charts. User dashboard + admin both. ✅ core DONE (📊 Usage modal) — ideas neeche.
- **Email notifications** — abhi in-app; baad me email (order status, offline alerts) — notification service me email channel add.
- **Offline notification batching** — ek saath kai devices offline ho (power cut) to har device ki alag notification na bhejo — ek "N devices offline" summary.
- **Per-room analytics** — 📊 Usage modal me room filter: "Main Room vs Other" toggles/on-time breakdown (abhi overall hai).
- **Peak usage hours** — hourly heatmap: kaunse ghante me sabse zyada activity (lights 8-10 PM pattern dikhe).
- **Analytics CSV export** — toggles/day + per-device table ko ek click me CSV download (family ko bhejne ke liye).
- **Weekly usage email** — har hafte "Is week 12h TV on raha" summary (email channel ke saath).
- **Admin platform analytics** — admin panel me saare homes ka aggregate usage (kitne devices active, total toggles/week).

## Phase 7 — AI

- **AI suggested automations** — usage history se "TV roz raat 9 baje on hota hai — schedule banaun?" jaise suggestions.
- **AI provider swappable** — OpenAI / Gemini / local Ollama modular service (plan me already).

## Phase 8 — Mobile

- **React Native/Expo app** — same API + shared types reuse; push notifications.

## Factory / ESP (hardware)

- **Webserver reach check** — provision ke baad board ka webserver (192.168.4.1 / LAN IP) HTTP-ping karke confirm karo ki web UI khul raha hai.
- **ESP poll interval** — 10s → 2-3s karne se web toggle <1s (battery/bandwidth thoda zyada) — firmware change, plan baad.
- **Bill print QR** — bill me bhi QR (payment/order) future.

## Courier (Phase 2 item 5)

- **Shiprocket integration** — jab account ban jaye: `docs/COURIER-TRACKING-PLAN.md` follow karo (AWB/webhook/30-min polling/My Orders live tracking).
- **Manual AWB entry UI** — Shiprocket ke bina bhi admin AWB daal ke tracking ready ho.

## Misc / product

- **Live site test checklist** — production pe full order flow (payment → serial → flash → deliver → claim) ek baar systemically.
- **Multi-device sticker naming collision check** — same username+order ke saath device index mismatch na ho (flasher board_index vs registry orderIdx).
- **Screenshots/recording** — demo video me Phase 2 flow (stickers, order details, AP edit) add karna (DEMO-WALKTHROUGH.md update).

---

*Rules: implement sirf phase-appropriate time pe; user review ke baad decide hota hai.*
