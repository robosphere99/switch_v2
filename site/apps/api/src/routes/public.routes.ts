import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AppError, ok } from "../lib/response";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { getRequestStats } from "../lib/requestTracker";
import { audit } from "../services/audit.service";
import { getPublicSiteSettings } from "../services/siteSettings.service";
import { verifyBillToken } from "../lib/billVerify";

import path from "path";
import fs from "fs";

export const publicRouter = Router();

// Serve Android APK
publicRouter.get("/apk", (req, res) => {
  const apkPath = path.resolve(process.cwd(), "../mobile/android/app/build/outputs/apk/debug/app-debug.apk");
  if (fs.existsSync(apkPath)) {
    res.download(apkPath, "SwitchNest.apk");
  } else {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "APK not built yet." } });
  }
});

// Public endpoints — spam / flood / abuser se bachao (per IP).
// Chatbot (rule-based, thoda DB) — har minute max 20.
const assistantLimiter = rateLimit({
  name: "public:assistant",
  windowMs: 60_000,
  max: 20,
  message: "Bahut zyada messages — thodi der baad try karo",
});
const adminAssistantLimiter = rateLimit({
  name: "public:assistant-admin",
  windowMs: 60_000,
  max: 30,
  message: "Bahut zyada messages — thodi der baad try karo",
});
// Contact form — spam protection (DB row + email pe jaata hai).
const contactLimiter = rateLimit({
  name: "public:contact",
  windowMs: 60 * 60_000,
  max: 5,
  message: "Bahut zyada contact messages — 1 ghanta baad try karo",
});
const supportFormLimiter = rateLimit({
  name: "public:support-form",
  windowMs: 60 * 60_000,
  max: 10,
  message: "Bahut zyada support messages — 1 ghanta baad try karo",
});
// Cheap GETs — runaway loop se bachne ke liye bas defensive.
const siteSettingsLimiter = rateLimit({
  name: "public:site-settings",
  windowMs: 60_000,
  max: 120,
});
const mySupportLimiter = rateLimit({
  name: "public:my-support",
  windowMs: 60_000,
  max: 60,
});

publicRouter.get("/site-settings", siteSettingsLimiter, async (_req, res) => {
  try {
    const settings = await getPublicSiteSettings();
    ok(res, settings);
  } catch (_err) {
    ok(res, {
      siteName: "SwitchNest",
      supportEmail: "support@switchnest.in",
      supportPhone: "+91 98765 43210",
      supportAddress: "SwitchNest Labs, Noida, UP",
      supportHours: "24/7 Support",
      brandColor: "#0284c7",
    });
  }
});

// ---------------------------------------------------------------------------
// Bill genuineness verify — bill QR scan karne pe khulta hai (public, bina
// login). HMAC-signed token se sirf asli bill verify hota hai; fake bill ka
// QR kabhi pass nahi hoga. Serial factory-tested status bhi yahin dikhta hai.
// ---------------------------------------------------------------------------
const verifyBillLimiter = rateLimit({
  name: "public:verify-bill",
  windowMs: 60_000,
  max: 120,
  message: "Bahut zyada verify requests — thodi der baad try karo",
});

publicRouter.get("/verify/bill/:token", verifyBillLimiter, async (req, res) => {
  const payload = verifyBillToken(typeof req.params.token === "string" ? req.params.token : "");
  if (!payload) {
    return ok(res, { verified: false, reason: "invalid_token" });
  }
  const order = await prisma.order.findUnique({
    where: { id: payload.orderId },
    include: {
      items: { orderBy: { id: "asc" } },
      user: { select: { username: true } },
      serials: {
        include: { product: { select: { name: true, modelCode: true } } },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!order) return ok(res, { verified: false, reason: "not_found" });

  const items = order.items.map((i) => ({
    productName: i.productName,
    quantity: i.quantity,
    price: i.price.toString(),
    serialCode: i.serialCode,
  }));
  const serials = order.serials.map((s) => ({
    serialCode: s.serialCode,
    modelCode: s.product.modelCode,
    status: s.status,
    tested: Boolean(s.testedAt),
    testedAt: s.testedAt,
    claimedAt: s.claimedAt,
    warrantyStatus: s.warrantyStatus,
  }));
  ok(res, {
    verified: true,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    status: order.status,
    paymentStatus: order.paymentStatus,
    totalAmount: order.totalAmount.toString(),
    buyer: { name: order.shippingName, username: order.user?.username ?? null },
    items,
    serials,
  });
});

// ---------------------------------------------------------------------------
// Public assistant — sales/support chat (bina login). Rule-based product
// advisor jo user ki need samajh kar sahi board suggest karta hai.
// ---------------------------------------------------------------------------

interface Suggestion {
  id: number;
  name: string;
  modelCode: string;
  relayCount: number;
  price: string;
  reason: string;
}

const CHIPS = [
  "Kis board ki zaroorat hai?",
  "Site kaise kaam karti hai?",
  "WiFi setup kaise hota hai?",
  "Dimmer chahiye",
  "Fan speed control",
  "IR remote se control",
  "Warranty kya milti hai?",
  "Payment ke options",
];

const FAQ: Array<{ test: RegExp; reply: string; chips?: string[] }> = [
  {
    test: /what is switchnest|yeh (kya|site) hai|kya hai ye|about (switchnest|site|company)|introduce|platform (kya|about)/i,
    reply:
      "SwitchNest ek smart-home IoT platform hai — WiFi relay boards (2CH se 8CH), dimmers aur fan regulators bechte hain. Board kharido → serial code se activate karo → app se ghar ke lights/fans/appliances ko kisi bhi jagah se control karo. Naya firmware bhi WiFi se hi (OTA) update hota hai — kabhi USB nahi chahiye.",
  },
  {
    test: /how (does )?(it|this|site) (work|kaam)|kaise kaam|kaise chalta|process|flow|kya kaam/i,
    reply:
      "Poora flow 4 step me: 1️⃣ Shop se board order karo (WiFi name/password order pe bhi de sakte ho) 2️⃣ Delivery pe box me unique serial code sticker milta hai 3️⃣ Serial code se device activate karo — board aapke home se link 4️⃣ App/dashboard se on-off control, timers, voice/AI assistant. Hardware factory me pre-tested aata hai aur OTA se updates milte rahte hain.",
  },
  {
    test: /wifi|wireless|set up|setup|config|network|connect (karo|karna)|internet/i,
    reply:
      "WiFi setup 2 tarike se: (1) Order ke waqt WiFi name + password de do — board factory me hi pre-configured flash hoke aayega, (2) Ya phir board first-boot pe apna khud ka WiFi (SwitchNest-IoT) kholta hai — phone se connect karke WiFi + server details daal do. Board phir khud connect ho jata hai. WiFi change ho jaye to captive portal se fresh setup ho jata hai.",
  },
  {
    test: /ota|update|firmware|upgrade|naya version|software/i,
    reply:
      "Haan — saare boards OTA (over-the-air) updates support karte hain. Naya firmware admin publish karta hai aur board khud WiFi se download + flash kar leta hai, bina USB ke. Update safe hai — dual-slot system, kuch gadbad ho to purana version wapas boot ho jata hai.",
  },
  {
    test: /warranty|guarantee|return|refund|repair|service/i,
    reply:
      "Har board ke sath serial claim ke din se 1 saal ki warranty milti hai. Koi problem aaye to Warranty page se claim file karo — support team approve karke resolution deti hai. Serial number se har board track hota hai (kaun kharida, kab bheja, kya status).",
  },
  {
    test: /pay|payment|cod|upi|price|cost|kitne ka|rate|rs\.? ?[0-9]/i,
    reply:
      "Payment options: Cash on Delivery (COD) aur UPI — online payment bhi (Razorpay) aa raha hai. Prices shop page pe: 2CH ₹599 · 4CH ₹799 · 5CH ₹899 · 6CH ₹999 · 8CH ₹1,199 · IR ₹999 · Fan Dimmer ₹899 · Dimmers ₹749-799. Ek baar order karke dekho — billing address + optional WiFi ke saath.",
  },
  {
    test: /ship|deliver|delivery|kab milega|shipping|dispatch|transport/i,
    reply:
      "Order ke baad status track hota hai: pending → paid → shipped → delivered. Delivery hone pe box pe serial sticker hota hai. India me sab jagah shipping available hai. Shipping ke baad hi serial code assign hota hai (flasher box me serial + WiFi pre-flash karta hai).",
  },
  {
    test: /activate|serial|claim|code|sticker|box/i,
    reply:
      "Delivery pe box ke andar sticker me unique serial code (RS-XXXX-XXXXXX) + QR code hota hai. QR scan karo ya Activate page pe serial daalo → apna home choose karo → board aapke account me aa jata hai. Serial = aapka ownership proof — koi aur usse claim nahi kar sakta.",
  },
  {
    test: /contact|phone|call|email|support|help|baat|number/i,
    reply:
      "Contact section me form bharke message bhej sakte ho — humara team reply karta hai. Email: support@switchnest.in · Phone/WhatsApp: +91 98765 43210 · Address: SwitchNest Labs, Noida, UP. Feedback bhi welcome hai!",
  },
  {
    test: /hello|hi|hey|namaste|namaskar|hii|hola|salaam/i,
    reply:
      "Namaste! 🙏 Main SwitchNest ka assistant hoon. Batao aapko kya chahiye — kitne lights/fans control karne hain, dimmer chahiye, IR remote se control karna hai, ya site ke baare me kuch poochna hai?",
  },
];

function detectNeed(text: string, products: Array<{ id: number; name: string; modelCode: string; relayCount: number; price: { toString(): string } }>): { reply: string; products: Suggestion[] } | null {
  const lower = text.toLowerCase();

  // ---- Dimmer ----
  if (/(dimmer|brightness|light dim|roshni (kam|zyada)|dima|bright)/i.test(lower)) {
    const steps = /4|four|chaar/.test(lower) ? "DIM-4S" : "DIM-3S";
    const picks = products.filter((p) => p.modelCode === steps);
    return {
      reply:
        steps === "DIM-4S"
          ? "4-step touch dimmer best rahega — off → 33% → 66% → 100%. Touch + app dono se control."
          : "3-step touch dimmer best rahega — off → 50% → 100%. Simple aur budget-friendly.",
      products: picks.map((p) => ({ ...p, price: p.price.toString(), reason: "Touch dimmer — brightness steps" })),
    };
  }

  // ---- Fan speed ----
  if (/(fan|pankh).{0,15}(speed|regulator|dim)|(speed|regulator).{0,15}(fan|pankh)|fan dim|regulator/i.test(lower)) {
    const picks = products.filter((p) => p.modelCode === "FAN-DIM");
    return {
      reply: "Fan Speed Dimmer (WiFi fan regulator) — purane 5-step regulator ki jagah. App se fan speed control karo, voice se bhi.",
      products: picks.map((p) => ({ ...p, price: p.price.toString(), reason: "Fan speed regulator" })),
    };
  }

  // ---- IR remote ----
  if (/(ir|remote|ac |tv |television|air condition)/i.test(lower)) {
    const picks = products.filter((p) => p.modelCode === "4CH-IR");
    return {
      reply: "4CH IR WiFi Relay Module — 4 relay + built-in IR receiver. AC/TV apne remote se bhi control hoga, app se bhi.",
      products: picks.map((p) => ({ ...p, price: p.price.toString(), reason: "IR remote + app control" })),
    };
  }

  // ---- Relay count from numbers ----
  const countMatch = lower.match(/(\d+)\s*(?:light|lights|fan|fans|switch|switches|room|channel|device|devices|bulb|bulbs|load|point|points)/) ||
    lower.match(/(?:light|lights|fan|fans|switch|switches|room|channel|device|devices|bulb|bulbs|load|point|points)\s*(\d+)/) ||
    lower.match(/\b(2|3|4|5|6|7|8)\b/);
  if (countMatch) {
    const n = parseInt(countMatch[1] ?? countMatch[0], 10);
    let model = "2CH";
    let note = "";
    if (n <= 2) { model = "2CH"; note = "2 devices ke liye perfect."; }
    else if (n <= 4) { model = "4CH"; note = "4 devices — ek room ke liye classic choice."; }
    else if (n <= 5) { model = "5CH"; note = "4 devices + 1 spare."; }
    else if (n <= 6) { model = "6CH"; note = "6 devices — medium home."; }
    else { model = "8CH"; note = "8 devices — poore ghar ka control ek panel se."; }
    const picks = products.filter((p) => p.modelCode === model);
    return {
      reply: `Aapko lagbhag ${n} devices control karne hain — **${model} WiFi Relay Board** best rahega. ${note} Relay channels khud map kar sakte ho (kis channel pe kaunsa device).`,
      products: picks.map((p) => ({ ...p, price: p.price.toString(), reason: `${n} devices ke liye ${p.relayCount} channel board` })),
    };
  }

  return null;
}

publicRouter.post("/assistant", assistantLimiter, optionalAuth, async (req, res) => {
  const text = String(req.body?.message ?? "").trim();
  if (!text) return ok(res, { reply: "Kuch likho — e.g. '4 lights control karne hain' ya 'dimmer chahiye'.", chips: CHIPS });

  // Logged-in admin hai to admin assistant hi jawab de — frontend pehle se alag
  // endpoint use karta hai, par yeh bhi safety net hai (kabhi detection miss ho to).
  if (req.user?.role === "system_admin") {
    return ok(res, await adminAssistantReply(text));
  }

  const products = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, name: true, modelCode: true, relayCount: true, price: true },
    orderBy: { id: "asc" },
  });

  // Need-based product suggestion pehle
  const need = detectNeed(text, products);
  if (need) return ok(res, { ...need, chips: CHIPS });

  // FAQ match
  for (const faq of FAQ) {
    if (faq.test.test(text)) {
      return ok(res, { reply: faq.reply, products: [], chips: faq.chips ?? CHIPS });
    }
  }

  // Fallback — sab products dikha do
  const picks = products.slice(0, 6).map((p) => ({ ...p, price: p.price.toString(), reason: "Sabse popular boards" }));
  return ok(res, {
    reply:
      "Poora clear nahi hua 🙂 — yeh rahe hamare boards, ya mujhe batao: kitne lights/fans? dimmer chahiye? IR remote se control karna hai? Main sahi board suggest kar dunga.",
    products: picks,
    chips: CHIPS,
  });
});

// ---------------------------------------------------------------------------
// Admin assistant — system_admin ke liye ALAG helper (Admin panel guide).
// Public customer assistant se bilkul alag: product/sales nahi, sirf admin
// features — stats, users, homes, devices, OTA, API keys, audit, support, settings.
// ---------------------------------------------------------------------------

const ADMIN_CHIPS = [
  "Kitne users online hain?",
  "Overview stats kaise dekhein?",
  "User ko block/delete kaise karein?",
  "Support inbox kaise use karein?",
  "Firmware OTA kaise push karein?",
  "Audit logs kaise check karein?",
];

const ADMIN_FAQ: Array<{ test: RegExp; reply: string; chips?: string[] }> = [
  {
    test: /overview|stats|statistics|dashboard|report|metrics|trend|kya chal raha/i,
    reply:
      "Admin panel ke **Overview** tab me platform ke saare stats milte hain — total users, active today, revenue, orders, homes, devices, ESP boards, API requests (24h), support messages, pending commands, API keys, audit events aur ESP logs. Neeche last 7 days ka signups/orders graph bhi hai. Koi bhi cheez turant dhundhni ho to top me **🆘 Find anything** use karo.",
  },
  {
    test: /user|member|customer|block|ban|delete user|role|kaun kaun/i,
    reply:
      "**Users** tab me har user dikhta hai — status (active/blocked) badal sakte ho, role (user/system_admin) assign kar sakte ho, delete bhi kar sakte ho. Kisi user ke orders, homes, devices aur ESP boards ka poora context **Support** inbox me user select karke **User Info** panel se milta hai.",
  },
  {
    test: /support|inbox|chat|conversation|reply|message aaya/i,
    reply:
      "**Support** tab WhatsApp-style inbox hai: conversations list left me, chat beech me, aur right me **User Info** panel (orders/homes/devices/boards). Quick replies ready hain (WiFi/OTA/Warranty/Order/Offline), attachments bhej sakte ho, chat mute/pin/clear kar sakte ho. Naya user message aaye to notification + unread badge se pata chal jata hai.",
  },
  {
    test: /ota|firmware|push update|flash|update push|version/i,
    reply:
      "**OTA / ESP** tab me firmware upload karke activate karte ho. Uske baad kisi ek board pe ya saare boards pe ek saath OTA push kar sakte ho. ESP boards rename karna, probe karna, aur online/offline status dekhna bhi yahin se hota hai.",
  },
  {
    test: /api key|api-key|integration|third.party|device access/i,
    reply:
      "**API Keys** tab me device-access API keys banate aur delete karte ho — ESP32 ya third-party integrations ke liye. Har key ka record audit log me bhi track hota hai.",
  },
  {
    test: /audit|log|track|history|activity|kisne kya/i,
    reply:
      "**Audit Log** tab me har important action track hota hai — kaun, kis entity pe, kya kiya, kab (user, entity type, meta, timestamp). Suspicious activity check karne ke liye perfect. ESP boards ki history alag se **OTA / ESP** tab me dikhti hai.",
  },
  {
    test: /settings|site setting|brand|test email|theme|contact info/i,
    reply:
      "**Settings** tab me site-wide settings hain — site name, support email/phone/address/hours, theme/brand color. **Test email** bhejkar verify bhi kar sakte ho ki email system sahi chal raha hai.",
  },
  {
    test: /search|find|dhundo|dhundho|lookup|khojo/i,
    reply:
      "Top me **🆘 Find anything** button aur **Global search** dono hain — users, homes, devices, ESP boards, orders, serials — jo bhi daalo, turant result. Kisi user ka context chahiye to **Support** inbox kholo.",
  },
  {
    test: /order|payment|revenue|sale|sell|shop|kitna bik/i,
    reply:
      "**Shop / Orders** tab me saare orders + payment status dikhte hain. **Overview** me revenue stats milte hain. Order cancel karna, payment verify karna — sab yahin se hota hai.",
  },
  {
    test: /hello|hi|hey|namaste|namaskar|hii|hola|salaam/i,
    reply:
      "Namaste Admin! 🛡️ Main SwitchNest ka admin assistant hoon. Admin panel ke har feature me guide kar sakta hoon — stats, users, homes, devices, OTA/firmware, API keys, audit logs, support inbox ya settings. Batao kya karna hai?",
  },
];

/** Live platform counts — admin assistant ke "kitne users online?" jaise sawaal ke liye. */
const DAY_MS = 86_400_000;
const FIVE_MIN_MS = 300_000;

interface AdminLiveStats {
  users: number;
  activeToday: number;
  onlineNow: number;
  homes: number;
  devices: number;
  onlineDevices: number;
  espBoards: number;
  offlineBoards: number;
  orders: number;
  pendingOrders: number;
  revenueTotal: number;
  revenueMonth: number;
  unreadSupport: number;
  apiKeys: number;
  apiRequests: { today: number; last24h: number; total: number };
}

async function adminLiveStats(): Promise<AdminLiveStats> {
  const dayAgo = new Date(Date.now() - DAY_MS);
  const fiveMinAgo = new Date(Date.now() - FIVE_MIN_MS);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    users,
    activeToday,
    onlineNow,
    homes,
    devices,
    onlineDevices,
    espBoards,
    offlineBoards,
    orders,
    pendingOrders,
    revenueTotal,
    revenueMonth,
    unreadSupport,
    apiKeys,
  ] = await Promise.all([
    prisma.user.count(),
    Promise.resolve(0), // lastLoginAt column not yet on production DB
    Promise.resolve(0), // lastLoginAt column not yet on production DB
    prisma.home.count(),
    prisma.device.count(),
    prisma.device.count({ where: { lastSeen: { gte: dayAgo } } }),
    prisma.espDevice.count(),
    prisma.espDevice.count({ where: { OR: [{ offline: true }, { lastSeen: { lt: fiveMinAgo } }] } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: "pending" } }),
    prisma.order.aggregate({ _sum: { totalAmount: true }, where: { paidAt: { not: null } } }),
    prisma.order.aggregate({ _sum: { totalAmount: true }, where: { paidAt: { not: null }, createdAt: { gte: monthStart } } }),
    prisma.supportMessage.count({ where: { senderRole: "user", readByAdmin: false, deletedAt: null } }),
    prisma.apiKey.count(),
  ]);
  const apiRequests = getRequestStats();

  return {
    users,
    activeToday,
    onlineNow,
    homes,
    devices,
    onlineDevices,
    espBoards,
    offlineBoards,
    orders,
    pendingOrders,
    revenueTotal: Number(revenueTotal._sum.totalAmount ?? 0),
    revenueMonth: Number(revenueMonth._sum.totalAmount ?? 0),
    unreadSupport,
    apiKeys,
    apiRequests,
  };
}

// Live-data intents — pehle match karte hain, phir FAQ (DB queries sirf tab jab zaroorat ho).
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const ADMIN_LIVE_INTENTS: Array<{ test: RegExp; reply: (s: AdminLiveStats) => string }> = [
  {
    test: /(kitne|kitna|how many|count).{0,15}(user|users|member|log|bande|account)|(user|users|member)s? (online|active)|online (user|users)|active user|kitne log/i,
    reply: (s) =>
      `Abhi platform pe **${plural(s.onlineNow, "user")} online** hain (last 5 min me active). Aaj (24h) **${plural(s.activeToday, "active user")}** — total **${plural(s.users, "registered user")}**. Devices: **${plural(s.onlineDevices, "device")}/${s.devices} online**, ESP boards: **${s.espBoards - s.offlineBoards}/${s.espBoards} online**.`,
  },
  {
    test: /(kitne|kitna|how many|count|total).{0,15}(order|sale|revenue|paisa|kamai)|revenue (kya|kitna|abhi)|kitna kamaya|total (revenue|orders)/i,
    reply: (s) =>
      `Total revenue: **₹${s.revenueTotal.toLocaleString("en-IN")}** (is mahine ₹${s.revenueMonth.toLocaleString("en-IN")}). Total orders: **${plural(s.orders, "order")}** — abhi **${plural(s.pendingOrders, "pending")}**.`,
  },
  {
    test: /(kitne|kitna|how many|count).{0,15}(device|board|esp)|device(s)? (online|offline)|board(s)? (online|offline)|online (device|board)/i,
    reply: (s) =>
      `Devices: **${plural(s.onlineDevices, "device")}/${s.devices} online** (24h me active). ESP boards: **${s.espBoards - s.offlineBoards}/${s.espBoards} online** — **${plural(s.offlineBoards, "board")} offline**. Homes: **${plural(s.homes, "home")}**, API keys: **${s.apiKeys}**.`,
  },
  {
    test: /(kitne|kitna|unread).{0,15}(support )?(message|chat)|unread (messages?|chats?)|pending (support|message|chat)/i,
    reply: (s) =>
      `Support me **${plural(s.unreadSupport, "unread message")}** hain abhi. Saari conversations **Support** tab me hain — unread badge se naye messages ka pata chal jata hai.`,
  },
  {
    test: /api (request|hit|call)|request(s)? (kitne|count|kitte)|kitne (request|hit)|traffic|kitna traffic/i,
    reply: (s) =>
      `API requests: **${plural(s.apiRequests.today, "request")}** aaj, **${plural(s.apiRequests.last24h, "request")}** last 24h — total **${plural(s.apiRequests.total, "request")}** all-time.`,
  },
];

/** Admin assistant — live stats, admin FAQ, fallback. */
async function adminAssistantReply(text: string): Promise<{ reply: string; products: Suggestion[]; chips: string[] }> {
  if (!text) {
    return { reply: "Kya help chahiye? e.g. 'Kitne users online hain?' ya 'Overview stats kaise dekhein?'", products: [], chips: ADMIN_CHIPS };
  }

  // Live stats intents — DB se asli numbers
  for (const intent of ADMIN_LIVE_INTENTS) {
    if (intent.test.test(text)) {
      const stats = await adminLiveStats();
      return { reply: intent.reply(stats), products: [], chips: ADMIN_CHIPS };
    }
  }

  // How-to FAQ
  for (const faq of ADMIN_FAQ) {
    if (faq.test.test(text)) {
      return { reply: faq.reply, products: [], chips: faq.chips ?? ADMIN_CHIPS };
    }
  }

  return {
    reply:
      "Yeh sawaal mera clear nahi hua 🙂 Main in cheezon me help kar sakta hoon — live stats (kitne users online, revenue, devices online), Overview, Users, Homes, Devices, OTA/firmware, API keys, Audit logs, Support inbox, Settings aur Global search. Koi ek batao — main jawab de dunga.",
    products: [],
    chips: ADMIN_CHIPS,
  };
}

publicRouter.post("/assistant/admin", adminAssistantLimiter, requireAuth, async (req, res) => {
  if (req.user!.role !== "system_admin") {
    throw new AppError("FORBIDDEN", "Admin access required", 403);
  }
  return ok(res, await adminAssistantReply(String(req.body?.message ?? "").trim()));
});

// ---------------------------------------------------------------------------
// Public contact / feedback form
// ---------------------------------------------------------------------------

publicRouter.post("/contact", contactLimiter, async (req, res) => {
  const name = String(req.body?.name ?? "").trim().slice(0, 100);
  const email = String(req.body?.email ?? "").trim().slice(0, 120) || null;
  const phone = String(req.body?.phone ?? "").trim().slice(0, 20) || null;
  const subject = String(req.body?.subject ?? "Feedback").trim().slice(0, 150);
  const message = String(req.body?.message ?? "").trim();

  if (!name) return ok(res, { error: "Name required" }, 400);
  if (!message) return ok(res, { error: "Message required" }, 400);
  if (message.length > 4000) return ok(res, { error: "Message 4000 chars se kam rakho" }, 400);

  const created = await prisma.contactMessage.create({
    data: { name, email, phone, subject, message },
  });
  ok(res, { id: created.id, status: created.status }, 201);
});

/** Logged-in user apni support tickets. */
publicRouter.get("/support/my", mySupportLimiter, requireAuth, async (req, res) => {
  const msgs = await prisma.contactMessage.findMany({
    where: { userId: req.user!.sub },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  ok(res, msgs);
});

// ---------------------------------------------------------------------------
// Authenticated support — logged-in users apne account se hi contact karein
// ---------------------------------------------------------------------------

publicRouter.post("/support", supportFormLimiter, requireAuth, async (req, res) => {
  const subject = String(req.body?.subject ?? "Support").trim().slice(0, 150);
  const message = String(req.body?.message ?? "").trim();
  const phone = String(req.body?.phone ?? "").trim().slice(0, 20) || null;
  const orderNumber = String(req.body?.orderNumber ?? "").trim().slice(0, 50) || null;

  if (!message) return ok(res, { error: "Message required" }, 400);
  if (message.length > 4000) return ok(res, { error: "Message 4000 chars se kam rakho" }, 400);

  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { id: true, username: true, email: true },
  });

  const created = await prisma.contactMessage.create({
    data: {
      userId: user?.id ?? req.user!.sub,
      name: user?.username ?? "User",
      email: user?.email ?? null,
      phone,
      subject: orderNumber ? `${subject} (Order ${orderNumber})` : subject,
      message,
    },
  });
  await audit(req.user!.sub, "user.support.contact", {
    entity: "contactMessage",
    entityId: created.id,
    meta: { subject },
  });
  ok(res, { id: created.id, status: created.status }, 201);
});
