import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ok } from "../lib/response";
import { requireAuth } from "../middleware/auth";
import { audit } from "../services/audit.service";

export const publicRouter = Router();

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

publicRouter.post("/assistant", async (req, res) => {
  const text = String(req.body?.message ?? "").trim();
  if (!text) return ok(res, { reply: "Kuch likho — e.g. '4 lights control karne hain' ya 'dimmer chahiye'.", chips: CHIPS });

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
// Public contact / feedback form
// ---------------------------------------------------------------------------

publicRouter.post("/contact", async (req, res) => {
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
publicRouter.get("/support/my", requireAuth, async (req, res) => {
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

publicRouter.post("/support", requireAuth, async (req, res) => {
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
