import { env } from "../config/env";
import { decryptSecret } from "./crypto";
import { getSiteSettings } from "../services/siteSettings.service";

/**
 * AI assistant — provider-agnostic chat completions client (Phase 7).
 *
 * Zero dependency (fetch + node: built-in) — Plesk pe naye packages risky.
 * OpenAI-compatible /chat/completions endpoint use karta hai, isliye ek hi
 * client in sab ke saath chalta hai:
 *   - OpenAI:        base https://api.openai.com/v1            model gpt-4o-mini...
 *   - Gemini:        base https://generativelanguage.googleapis.com/v1beta/openai  model gemini-2.0-flash...
 *   - Ollama (local): base http://localhost:11434/v1           model llama3.2...
 *
 * Config 2 jagah se:
 *   1. Admin → Settings (app_meta, encrypted apiKey) — UI se set hota hai.
 *   2. env fallback (site/.env): AI_PROVIDER/AI_API_KEY/AI_BASE_URL/AI_MODEL.
 * DB wali precedence leti hai (UI = source of truth), env sirf fallback.
 * Provider empty → assistant rule-based (purana behaviour).
 */

export interface AiConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

const DEFAULT_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  ollama: "http://localhost:11434/v1",
};

/** Env se config (site/.env) — fallback jab settings me kuch set na ho. */
function envAiConfig(): AiConfig {
  const provider = (env.AI_PROVIDER || "").trim().toLowerCase();
  const configured = Boolean(provider && env.AI_MODEL);
  return {
    provider,
    apiKey: env.AI_API_KEY?.trim() ?? "",
    baseUrl: (env.AI_BASE_URL?.trim() || DEFAULT_BASE_URLS[provider] || "").replace(/\/$/, ""),
    model: env.AI_MODEL?.trim() ?? "",
    ...(configured ? {} : { provider: "" as const, model: "" }),
  };
}

/**
 * Asli config — DB (admin settings) pehle, env fallback.
 * DB ke aiProvider set ho to DB ki saari values precedence leti hain.
 */
export async function getAiConfig(): Promise<AiConfig> {
  let db: Partial<AiConfig> = {};
  try {
    const s = await getSiteSettings();
    if (s.aiProvider) {
      let apiKey = "";
      if (s.aiApiKey) {
        try {
          apiKey = decryptSecret(s.aiApiKey);
        } catch {
          apiKey = s.aiApiKey; // purana plaintext fallback
        }
      }
      db = { provider: s.aiProvider, apiKey, baseUrl: s.aiBaseUrl, model: s.aiModel };
    }
  } catch {
    /* DB down / not installed → env fallback */
  }

  const cfg: AiConfig = { ...envAiConfig(), ...db };
  const configured = Boolean(cfg.provider && cfg.model);
  if (!configured) {
    return { provider: "", apiKey: "", baseUrl: "", model: "" };
  }
  return {
    ...cfg,
    provider: cfg.provider.trim().toLowerCase(),
    baseUrl: (cfg.baseUrl.trim() || DEFAULT_BASE_URLS[cfg.provider] || "").replace(/\/$/, ""),
  };
}

/** LLM configured hai? (provider + model set ho to) */
export async function aiConfigured(): Promise<boolean> {
  const c = await getAiConfig();
  return Boolean(c.provider && c.model && c.baseUrl);
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

/** Chat completion — reply text return karta hai. Failure pe throw (caller fallback karega). */
export async function chatCompletion(opts: ChatCompletionOptions): Promise<string> {
  const cfg = await getAiConfig();
  if (!cfg.provider || !cfg.model || !cfg.baseUrl) {
    throw new Error("AI not configured (AI_PROVIDER/AI_MODEL)");
  }
  if (cfg.provider !== "ollama" && !cfg.apiKey) {
    throw new Error(`AI provider "${cfg.provider}" ke liye AI_API_KEY chahiye`);
  }

  const timeoutMs = opts.timeoutMs ?? 25_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "system", content: opts.system }, ...opts.messages],
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 500,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`LLM API ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };
    if (data.error?.message) throw new Error(`LLM error: ${data.error.message}`);
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("LLM: empty response");
    return content.trim();
  } finally {
    clearTimeout(timer);
  }
}
