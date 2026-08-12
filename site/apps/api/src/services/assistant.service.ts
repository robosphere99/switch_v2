import { prisma } from "../lib/prisma";
import { AppError } from "../lib/response";
import { audit } from "./audit.service";
import { setDeviceStatus } from "./device.service";
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
    matchedBy: all ? "all" : types.length > 0 ? `type:${types.join(",")}` : matches.length > 0 ? "name" : "none",
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
// Message flow: user message -> parse -> assistant reply (with proposal)
// ---------------------------------------------------------------------------

export async function sendMessage(userId: number, chatId: number, content: string) {
  const chat = await getChat(userId, chatId);
  if (!chat) throw new AppError("NOT_FOUND", "Chat not found", 404);

  const userMessage = await prisma.assistantMessage.create({
    data: { chatId, role: "user", content },
  });

  const devices = await prisma.device.findMany({
    where: { homeId: chat.homeId },
    select: { id: true, name: true, type: true, status: true },
  });

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
