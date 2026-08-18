import { prisma } from "../lib/prisma";
import { AppError } from "../lib/response";
import { audit } from "./audit.service";
import { setDeviceStatus } from "./device.service";
import { aiConfigured, chatCompletion } from "../lib/ai";
import type { DeviceStatus } from "@robosphere/shared";

// ---------------------------------------------------------------------------
// Rule-based intent parser (English + Hindi). Provider-agnostic — a real LLM
// adapter can replace `parseIntent` later behind the same `assistantReply()`
// interface without touching routes or the UI.
// ---------------------------------------------------------------------------

export interface ParsedAction {
  deviceId: number;
  deviceName: string;
  action: DeviceStatus;
}

const ON_PATTERNS = [
  /\b(turn\s+)?on\b/,
  /\bstart\b/,
  /\bchalu\b/,
  /\bjalo\b/,
  /\bopen\b/,
  /\bkholo\b/,
];
const OFF_PATTERNS = [
  /\b(turn\s+)?off\b/,
  /\bstop\b/,
  /\bband\b/,
  /\bbujha\b/,
  /\bclose\b/,
  /\bband karo\b/,
];
const ALL_PATTERNS = [/\ball\b/, /\bsab\b/, /\bsabhi\b/, /\bsaare\b/, /\beverything\b/, /\bhar ek\b/];

const TYPE_KEYWORDS: Array<{ types: string[]; words: RegExp }> = [
  { types: ["fan"], words: /\bfan\b|\bpankh/ },
  { types: ["bulb", "light"], words: /\blight|\bbulb\b|\blamp\b|\bdiya\b/ },
  { types: ["tv"], words: /\btv\b|\btelevision\b/ },
  { types: ["ac"], words: /\bac\b|\bair\s*condition|\bcooler\b/ },
  { types: ["plug"], words: /\bplug\b|\bsocket\b/ },
];

function detectAction(text: string): DeviceStatus | null {
  const lower = text.toLowerCase();
  const hasOn = ON_PATTERNS.some((r) => r.test(lower));
  const hasOff = OFF_PATTERNS.some((r) => r.test(lower));
  if (hasOn && hasOff) return null; // ambiguous
  if (hasOn) return "on";
  if (hasOff) return "off";
  return null;
}

function isAllRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return ALL_PATTERNS.some((r) => r.test(lower));
}

function matchedTypes(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const t of TYPE_KEYWORDS) {
    if (t.words.test(lower)) for (const ty of t.types) found.add(ty);
  }
  return [...found];
}

/**
 * Parse a natural-language command against the home's devices.
 * Returns matched devices + the requested action (on/off), or null if unclear.
 */
export function parseIntent(text: string, devices: { id: number; name: string; type: string }[]): {
  action: DeviceStatus | null;
  actions: ParsedAction[];
  matchedBy: string;
} {
  const action = detectAction(text);
  const lower = text.toLowerCase();
  const all = isAllRequest(text);
  const types = matchedTypes(text);

  let matches: { id: number; name: string; type: string }[] = [];

  if (all && types.length === 0) {
    // "all devices" / "sab kuch" → everything
    matches = devices;
  } else {
    // 1. exact device names mentioned in the text
    for (const d of devices) {
      if (lower.includes(d.name.toLowerCase())) matches.push(d);
    }
    // 2. type keywords (fan/light/tv/...)
    //    → all devices of those types (also covers "saare lights" = all lights)
    if (types.length > 0) {
      for (const d of devices) {
        if (types.includes(d.type) && !matches.includes(d)) matches.push(d);
      }
    }
  }

  return {
    action,
    actions: action
      ? matches.map((d) => ({ deviceId: d.id, deviceName: d.name, action }))
      : [],
    // Asli match kaise hua: type keyword ("saare lights" → type, sirf lights,
    // "all" nahi) > all > exact name > kuch nahi.
    matchedBy: types.length > 0 ? `type:${types.join(",")}` : all ? "all" : matches.length > 0 ? "name" : "none",
  };
}

// ---------------------------------------------------------------------------
// Chat CRUD
// ---------------------------------------------------------------------------

export async function createChat(userId: number, homeId: number, title?: string) {
  return prisma.assistantChat.create({
    data: { userId, homeId, title: title?.trim() || "AI Assist" },
  });
}

export async function listChats(userId: number) {
  return prisma.assistantChat.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export async function getChat(userId: number, chatId: number) {
  return prisma.assistantChat.findFirst({ where: { id: chatId, userId } });
}

export async function listMessages(chatId: number) {
  return prisma.assistantMessage.findMany({
    where: { chatId },
    orderBy: { createdAt: "asc" },
  });
}

/** Assistant message content layout: plain text for user, JSON for assistant. */
export function encodeAssistantContent(text: string, proposal: ParsedAction[] | null): string {
  return JSON.stringify({ text, proposal });
}

export function decodeAssistantContent(content: string): {
  text: string;
  proposal: ParsedAction[] | null;
} {
  try {
    const parsed = JSON.parse(content) as { text?: string; proposal?: ParsedAction[] | null };
    return { text: parsed.text ?? content, proposal: parsed.proposal ?? null };
  } catch {
    return { text: content, proposal: null };
  }
}

// ---------------------------------------------------------------------------
// Status check + troubleshooting (non-command queries)
// ---------------------------------------------------------------------------

const STATUS_PATTERNS = [
  /\bstatus\b/,
  /\bstates?\b/,
  /\bkya (haal|hal)\b/,
  /\bkaise (hai|hain)\b/,
  /\bcheck\b/,
  /\bcondition\b/,
  /\bkaun se (on|chalu)\b/,
  /\bwhich.*(on|chalu)\b/,
  /\bsab (on|off|chalu|band)\b/,
  /\bkitne (on|chalu)\b/,
];

const TROUBLE_PATTERNS = [
  /\bkaam nahi (kar raha|kar rahi)\b/,
  /\bnahi (chal|chalu|khul|khuli|ja raha|ho raha)\b/,
  /\bnot (working|turning|responding)\b/,
  /\bproblem\b/,
  /\bissue\b/,
  /\bkharab\b/,
  /\bgadbad\b/,
  /\btrouble\b/,
  /\bbroken\b/,
  /\bkyu(n)?\b.*\bnahi\b/,
  /\bwhy.*(not|isn.t)\b/,
  /\bmadad\b/,
];

const ONLINE_PATTERNS = [/online/, /offline/, /connected/, /zinda/, /available/];

function detectQueryType(text: string): "status" | "troubleshoot" | null {
  const lower = text.toLowerCase();
  if (TROUBLE_PATTERNS.some((r) => r.test(lower))) return "troubleshoot";
  if (STATUS_PATTERNS.some((r) => r.test(lower)) || ONLINE_PATTERNS.some((r) => r.test(lower))) return "status";
  return null;
}

interface DeviceBrief {
  id: number;
  name: string;
  type: string;
  status: string;
  lastSeen: Date | null;
  offline: boolean;
  ipAddress: string | null;
  firmwareVersion: string | null;
  _count?: { commands: number };
}

function fmtRelative(ts: Date | null): string {
  if (!ts) return "kabhi nahi";
  const mins = Math.floor((Date.now() - ts.getTime()) / 60000);
  if (mins < 1) return "abhi";
  if (mins < 60) return `${mins} min pehle`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ghante pehle`;
  return `${Math.floor(hrs / 24)} din pehle`;
}

function deviceOnline(d: DeviceBrief): boolean {
  if (d.offline) return false;
  if (!d.lastSeen) return false;
  return Date.now() - d.lastSeen.getTime() < 24 * 60 * 60 * 1000;
}

function buildStatusReply(devices: DeviceBrief[], content: string): string {
  const lower = content.toLowerCase();
  const matched = devices.filter((d) => lower.includes(d.name.toLowerCase()));
  const list = matched.length > 0 ? matched : devices;
  const lines = list.map((d) => {
    const st = d.status === "on" ? "ON ✅" : "OFF";
    const conn = deviceOnline(d) ? "online" : "offline ⚠️";
    return `• ${d.name} — ${st} (${conn}, last seen ${fmtRelative(d.lastSeen)})`;
  });
  const header =
    matched.length > 0
      ? `📊 "${content.trim()}" ka status:`
      : `📊 Tumhare home ke devices ka status:`;
  return (
    `${header}
${lines.join(String.fromCharCode(10))}` +
    `

Kisi device ki problem ho to bolo — jaise "bulb kyu kaam nahi kar raha".`
  );
}

function buildTroubleshootReply(devices: DeviceBrief[], content: string): string {
  const lower = content.toLowerCase();
  const matched = devices.filter((d) => lower.includes(d.name.toLowerCase()));
  const target = matched.length > 0 ? matched : devices;
  const parts: string[] = [];

  for (const d of target) {
    const pending = d._count?.commands ?? 0;
    parts.push(`🔧 ${d.name}:`);
    parts.push(`  • Status: ${d.status.toUpperCase()}`);
    parts.push(`  • Connection: ${deviceOnline(d) ? "ONLINE" : "OFFLINE ⚠️"} (last seen ${fmtRelative(d.lastSeen)})`);
    if (d.firmwareVersion) parts.push(`  • Firmware: ${d.firmwareVersion}`);
    if (d.ipAddress) parts.push(`  • Board IP: ${d.ipAddress}`);
    parts.push(`  • Pending commands: ${pending}`);

    if (!deviceOnline(d)) {
      parts.push(`  → ${d.name} board se connected NAHI hai.`);
      parts.push(`    Fix: (1) Board ka power check karo (USB/adapter)  (2) WiFi router on hai?  (3) Board reboot karo`);
    } else if (pending > 0) {
      parts.push(`  → Kuch commands atki hui hain (pending queue).`);
      parts.push(`    Fix: (1) 5-10 sec wait karo — board har 5s poll karta hai  (2) fir bhi na ho to support se "clear stuck commands" karwao`);
    } else if (d.status === "on") {
      parts.push(`  → Device ON dikh raha hai par kaam nahi kar raha?`);
      parts.push(`    Fix: (1) wiring/connection check karo  (2) kisi dusre device se relay test karo`);
    } else {
      parts.push(`  → Device OFF hai. Pehle ON karo — "ON karo" bolo ya dashboard se toggle karo.`);
    }
  }

  return (
    parts.join(String.fromCharCode(10)) +
    `

Aur madad chahiye? Board level ki details ke liye admin/support se baat karo.`
  );
}

// ---------------------------------------------------------------------------
// Phase 7 — LLM reply (hybrid). Configured ho to pehle LLM try karo;
// fail/not-configured → rule-based fallback (neeche). Execution HAMESHA
// confirm-gated hai — LLM sirf proposal deta hai, execute nahi.
// ---------------------------------------------------------------------------

interface LlmReply {
  content: string;
  proposal: ParsedAction[] | null;
}

function buildDeviceContext(devices: DeviceBrief[]): string {
  return devices
    .map((d) => `- id=${d.id} name="${d.name}" type=${d.type} status=${d.status}`)
    .join("\n");
}

const LLM_SYSTEM_PROMPT = `Tu SwitchNest ka AI assistant hai — smart-home device control + chat helper.
Reply Hinglish me do (Roman Hindi + thoda English), chhota aur friendly.

Home ke devices (sirf inhi ids use karo):
{devices}

Rules:
1. Agar user device ON/OFF karna chahta hai to SIRF ye JSON format do (koi aur text nahi, code fence bhi nahi):
{"actions":[{"deviceId":1,"action":"on"}],"reply":"<chhota confirm message>"}
   - Device name/type se sahi id match karo (case-insensitive).
   - Group request ("saare lights", "all fans") me saare matching devices ke actions do.
   - Action sirf "on" ya "off" ho sakta hai.
2. Agar user sirf sawaal/puchta hai (help, status, baat-cheet) to seedha normal reply do — bina JSON.
3. Kabhi bhi devices list me na ho to us device ka action mat do — reply me bata do ki device nahi mila.`;

/** Code fences / extra text se pehla JSON object nikaalo. */
export function extractJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** LLM reply se actions proposal banao — deviceId/action validate karke. */
export function parseLlmActions(
  raw: Record<string, unknown>,
  devices: DeviceBrief[],
): { reply: string; actions: ParsedAction[] } | null {
  const reply = typeof raw.reply === "string" ? raw.reply.trim() : "";
  const actionsRaw = Array.isArray(raw.actions) ? raw.actions : [];
  const deviceMap = new Map(devices.map((d) => [d.id, d]));
  const actions: ParsedAction[] = [];
  for (const a of actionsRaw) {
    const o = a as { deviceId?: unknown; action?: unknown };
    const deviceId = Number(o.deviceId);
    const device = deviceMap.get(deviceId);
    if (!device) continue;
    if (o.action !== "on" && o.action !== "off") continue;
    actions.push({ deviceId, deviceName: device.name, action: o.action });
  }
  return { reply: reply || (actions.length ? "Confirm karo to execute ho jayega." : ""), actions };
}

/**
 * LLM try karo — success: {content, proposal}; LLM off/fail/invalid: null
 * (caller rule-based pe fallback karta hai). Kabhi throw nahi.
 */
async function tryLlmReply(
  content: string,
  devices: DeviceBrief[],
): Promise<LlmReply | null> {
  if (!(await aiConfigured())) return null;
  try {
    const raw = await chatCompletion({
      system: LLM_SYSTEM_PROMPT.replace("{devices}", buildDeviceContext(devices) || "(koi device nahi)"),
      messages: [{ role: "user", content }],
      maxTokens: 400,
    });
    const json = extractJsonObject(raw);
    if (json) {
      const parsed = parseLlmActions(json, devices);
      if (parsed && parsed.actions.length > 0) {
        return { content: parsed.reply, proposal: parsed.actions };
      }
      if (parsed && parsed.reply) {
        // JSON diya par koi valid action nahi — reply hi bolo (LLM ne device nahi mila hoga)
        return { content: parsed.reply, proposal: null };
      }
      return null; // invalid JSON shape → fallback
    }
    // Plain conversational reply
    return { content: raw, proposal: null };
  } catch (err) {
    console.error("[assistant] LLM failed — rule-based fallback:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Message flow: user message -> LLM (agar configured) / rule parse -> reply
// ---------------------------------------------------------------------------

export async function sendMessage(userId: number, chatId: number, content: string) {
  const chat = await getChat(userId, chatId);
  if (!chat) throw new AppError("NOT_FOUND", "Chat not found", 404);

  const userMessage = await prisma.assistantMessage.create({
    data: { chatId, role: "user", content },
  });

  const devices = await prisma.device.findMany({
    where: { homeId: chat.homeId },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      lastSeen: true,
      offline: true,
      ipAddress: true,
      firmwareVersion: true,
      _count: { select: { commands: { where: { status: "pending" } } } },
    },
  });

  // Status / troubleshooting questions pehle — command flow me nahi jaane dena.
  // (Rule-based deterministic hai — LLM se bhi pehle, taaki status hamesha sahi)
  const queryType = detectQueryType(content);
  if (queryType) {
    const replyText =
      queryType === "troubleshoot"
        ? buildTroubleshootReply(devices, content)
        : buildStatusReply(devices, content);
    const assistantMessage = await prisma.assistantMessage.create({
      data: { chatId, role: "assistant", content: encodeAssistantContent(replyText, null) },
    });
    if (chat.title === "AI Assist" && content.trim().length > 0) {
      await prisma.assistantChat.update({
        where: { id: chat.id },
        data: { title: content.trim().slice(0, 60) },
      });
    }
    return { chat, userMessage, assistantMessage: { ...assistantMessage, content: replyText, proposal: null } };
  }

  // Phase 7: LLM configured → try karo (conversational + control dono)
  const llm = await tryLlmReply(content, devices);
  if (llm) {
    const assistantMessage = await prisma.assistantMessage.create({
      data: { chatId, role: "assistant", content: encodeAssistantContent(llm.content, llm.proposal) },
    });
    if (chat.title === "AI Assist" && content.trim().length > 0) {
      await prisma.assistantChat.update({
        where: { id: chat.id },
        data: { title: content.trim().slice(0, 60) },
      });
    }
    return {
      chat,
      userMessage,
      assistantMessage: { ...assistantMessage, content: llm.content, proposal: llm.proposal },
    };
  }

  // Rule-based fallback (LLM off / fail / invalid)
  const parsed = parseIntent(content, devices);
  let replyText: string;
  let proposal: ParsedAction[] | null = null;

  if (!parsed.action) {
    replyText =
      "Mujhe samajh nahi aaya ki device ON karni hai ya OFF. Kuch aise bolo:\n" +
      "• \"turn on the fan\" / \"pankha chalu karo\"\n" +
      "• \"turn off all lights\" / \"saare bulbs band karo\"\n" +
      "• \"TV on karo\"";
  } else if (parsed.actions.length === 0) {
    replyText =
      "Mujhe koi device nahi mili is home me jo tumhari baat se match kare. " +
      "Device ka naam batao (jaise PANKHA, TV, Bulb) ya \"all devices\" bolo.";
  } else {
    proposal = parsed.actions;
    const labels = parsed.actions.map((a) => `${a.deviceName} (${a.action.toUpperCase()})`);
    replyText = `Main in devices ko ${parsed.action.toUpperCase()} kar dunga:\n• ${labels.join(
      "\n• ",
    )}\n\nConfirm karo to execute ho jayega.`;
  }

  const assistantMessage = await prisma.assistantMessage.create({
    data: { chatId, role: "assistant", content: encodeAssistantContent(replyText, proposal) },
  });

  // Auto-title the chat from the first user message
  if (chat.title === "AI Assist" && content.trim().length > 0) {
    await prisma.assistantChat.update({
      where: { id: chat.id },
      data: { title: content.trim().slice(0, 60) },
    });
  }

  return { chat, userMessage, assistantMessage: { ...assistantMessage, content: replyText, proposal } };
}

// ---------------------------------------------------------------------------
// Confirm -> execute the proposal (member role already enforced at route level)
// ---------------------------------------------------------------------------

export async function confirmProposal(userId: number, chatId: number, messageId: number) {
  const chat = await getChat(userId, chatId);
  if (!chat) throw new AppError("NOT_FOUND", "Chat not found", 404);

  const message = await prisma.assistantMessage.findFirst({
    where: { id: messageId, chatId, role: "assistant" },
  });
  if (!message) throw new AppError("NOT_FOUND", "Proposal message not found", 404);

  const { proposal } = decodeAssistantContent(message.content);
  if (!proposal || proposal.length === 0) {
    throw new AppError("BAD_REQUEST", "This message has no executable proposal", 400);
  }

  const results: Array<{ deviceId: number; deviceName: string; action: DeviceStatus; ok: boolean; error?: string }> = [];

  for (const p of proposal) {
    try {
      await setDeviceStatus({ homeId: chat.homeId, deviceId: p.deviceId, actorId: userId, status: p.action });
      results.push({ deviceId: p.deviceId, deviceName: p.deviceName, action: p.action, ok: true });
    } catch (err) {
      results.push({
        deviceId: p.deviceId,
        deviceName: p.deviceName,
        action: p.action,
        ok: false,
        error: err instanceof Error ? err.message : "failed",
      });
    }
  }

  const done = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  let replyText = `✅ ${done} device(s) ${results[0]?.action.toUpperCase() ?? ""} ho gaye: ${results
    .filter((r) => r.ok)
    .map((r) => r.deviceName)
    .join(", ")}.`;
  if (failed.length > 0) {
    replyText += `\n❌ Failed: ${failed.map((r) => `${r.deviceName} (${r.error})`).join(", ")}`;
  }

  const assistantMessage = await prisma.assistantMessage.create({
    data: { chatId, role: "assistant", content: encodeAssistantContent(replyText, null) },
  });

  await audit(userId, "assistant.execute", {
    homeId: chat.homeId,
    entity: "assistant",
    entityId: chat.id,
    meta: { results },
  });

  return { results, assistantMessage: { ...assistantMessage, content: replyText, proposal: null } };
}
