import { env } from "../config/env";

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
 * Config env se (site/.env):
 *   AI_PROVIDER=openai|gemini|ollama   AI_API_KEY=...   AI_BASE_URL=...   AI_MODEL=...
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

export function getAiConfig(): AiConfig {
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

/** LLM configured hai? (provider + model set ho to) */
export function aiConfigured(): boolean {
  const c = getAiConfig();
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
  const cfg = getAiConfig();
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
