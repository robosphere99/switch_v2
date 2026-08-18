import { afterEach, describe, expect, it, vi } from "vitest";

// env mock — deterministic AI config. Pura env dena zaroori hai: import graph
// ke modules (crypto → WIFI_ENC_KEY, socket → corsOrigins) module-load pe padhte hain.
vi.mock("../config/env", () => ({
  env: {
    AI_PROVIDER: "openai",
    AI_API_KEY: "sk-test",
    AI_BASE_URL: "",
    AI_MODEL: "gpt-4o-mini",
    WIFI_ENC_KEY: "test-wifi-key",
    LOG_LEVEL: "warn",
    ADMIN_EMAIL: "admin@test.local",
  },
  corsOrigins: ["http://localhost:5173"],
}));

// siteSettings mock — DB/AI config ko deterministic rakho (env fallback path test karna hai).
vi.mock("../services/siteSettings.service", () => ({
  getSiteSettings: vi.fn().mockResolvedValue({
    siteName: "Test", supportEmail: "", supportPhone: "", supportAddress: "", supportHours: "",
    brandColor: "#2563eb", siteUrl: "", smtpHost: "", smtpPort: 0, smtpUser: "", smtpPass: "",
    smtpFrom: "", smtpSecure: false, aiProvider: "", aiApiKey: "", aiBaseUrl: "", aiModel: "",
  }),
  updateSiteSettings: vi.fn(),
  getPublicSiteSettings: vi.fn(),
}));

const { chatCompletion, aiConfigured, getAiConfig } = await import("./ai");
const { extractJsonObject, parseLlmActions } = await import("../services/assistant.service");

const DEVICES = [
  { id: 1, name: "PANKHA", type: "fan", status: "off" },
  { id: 2, name: "TV", type: "tv", status: "off" },
] as unknown as Parameters<typeof parseLlmActions>[1];

describe("getAiConfig / aiConfigured", () => {
  it("resolves OpenAI default base URL (env fallback)", async () => {
    const c = await getAiConfig();
    expect(c.provider).toBe("openai");
    expect(c.baseUrl).toBe("https://api.openai.com/v1");
    expect(c.model).toBe("gpt-4o-mini");
    expect(await aiConfigured()).toBe(true);
  });

  it("DB (admin settings) precedence — provider set ho to env override hota hai", async () => {
    const { getSiteSettings } = await import("../services/siteSettings.service");
    vi.mocked(getSiteSettings).mockResolvedValueOnce({
      siteName: "Test", supportEmail: "", supportPhone: "", supportAddress: "", supportHours: "",
      brandColor: "#2563eb", siteUrl: "", smtpHost: "", smtpPort: 0, smtpUser: "", smtpPass: "",
      smtpFrom: "", smtpSecure: false,
      aiProvider: "gemini", aiApiKey: "sk-db-plain", aiBaseUrl: "", aiModel: "gemini-2.0-flash",
    });
    const c = await getAiConfig();
    expect(c.provider).toBe("gemini"); // env openai tha, DB gemini
    expect(c.model).toBe("gemini-2.0-flash");
    expect(c.apiKey).toBe("sk-db-plain");
    expect(c.baseUrl).toBe("https://generativelanguage.googleapis.com/v1beta/openai");
  });

  it("DB provider blank ho to env fallback chalta hai", async () => {
    const { getSiteSettings } = await import("../services/siteSettings.service");
    vi.mocked(getSiteSettings).mockResolvedValueOnce({
      siteName: "Test", supportEmail: "", supportPhone: "", supportAddress: "", supportHours: "",
      brandColor: "#2563eb", siteUrl: "", smtpHost: "", smtpPort: 0, smtpUser: "", smtpPass: "",
      smtpFrom: "", smtpSecure: false, aiProvider: "", aiApiKey: "", aiBaseUrl: "", aiModel: "",
    });
    const c = await getAiConfig();
    expect(c.provider).toBe("openai"); // env se
  });
});

describe("chatCompletion", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts to /chat/completions with Bearer auth and returns content", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "Pankha ON kar dunga" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const reply = await chatCompletion({
      system: "system prompt",
      messages: [{ role: "user", content: "pankha chalu karo" }],
    });

    expect(reply).toBe("Pankha ON kar dunga");
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string>; body: string }];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer sk-test");
    expect(JSON.parse(init.body).model).toBe("gpt-4o-mini");
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "bad key" }),
    );
    await expect(
      chatCompletion({ system: "s", messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow(/401/);
  });

  it("throws on API error field / empty response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: { message: "quota" } }) }));
    await expect(chatCompletion({ system: "s", messages: [] })).rejects.toThrow(/quota/);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) }));
    await expect(chatCompletion({ system: "s", messages: [] })).rejects.toThrow(/empty/);
  });
});

describe("extractJsonObject", () => {
  it("extracts JSON from code fences", () => {
    expect(extractJsonObject('```json\n{"actions":[]}\n```')).toEqual({ actions: [] });
  });
  it("extracts JSON from plain text", () => {
    expect(extractJsonObject('Ok, {"actions":[{"deviceId":1}],"reply":"done"} thanks')).toEqual({
      actions: [{ deviceId: 1 }],
      reply: "done",
    });
  });
  it("returns null on invalid JSON", () => {
    expect(extractJsonObject("no json here")).toBeNull();
    expect(extractJsonObject("{broken")).toBeNull();
  });
});

describe("parseLlmActions", () => {
  it("validates deviceId + action, builds proposal", () => {
    const r = parseLlmActions(
      { actions: [{ deviceId: 1, action: "on" }], reply: "Pankha ON" },
      DEVICES,
    );
    expect(r?.actions).toEqual([{ deviceId: 1, deviceName: "PANKHA", action: "on" }]);
    expect(r?.reply).toBe("Pankha ON");
  });

  it("ignores unknown device / bad action", () => {
    const r = parseLlmActions(
      { actions: [{ deviceId: 999, action: "on" }, { deviceId: 2, action: "maybe" }], reply: "x" },
      DEVICES,
    );
    expect(r?.actions).toEqual([]);
    expect(r?.reply).toBe("x");
  });
});
