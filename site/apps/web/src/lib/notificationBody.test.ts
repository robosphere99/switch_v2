import { describe, expect, it } from "vitest";
import { buildAdminReplyDraft, buildSupportDraft, parseNotificationBody } from "./notificationBody";

/**
 * Draft builders ke liye automated tests.
 *
 * IMPORTANT: yeh list API me generate hone wale HAR notification title ko enumerate
 * karti hai (site/apps/api me createNotification ke title patterns se). Agar API me
 * koi naya notification type add ho, to yahan bhi ek entry add karna — "template miss"
 * isi se pakda jata hai.
 */

// ---------- parseNotificationBody ----------

describe("parseNotificationBody", () => {
  it("JSON marker {u, t} se targetUserId + text nikalta hai", () => {
    const parsed = parseNotificationBody(JSON.stringify({ u: 42, t: "mera device on nahi ho raha" }));
    expect(parsed.targetUserId).toBe(42);
    expect(parsed.text).toBe("mera device on nahi ho raha");
  });

  it("plain text body → text as-is, no targetUserId", () => {
    const parsed = parseNotificationBody("bas ek text message");
    expect(parsed.text).toBe("bas ek text message");
    expect(parsed.targetUserId).toBeUndefined();
  });

  it("invalid JSON → text as-is", () => {
    const parsed = parseNotificationBody("{broken json");
    expect(parsed.text).toBe("{broken json");
  });

  it("null/empty body → empty text", () => {
    expect(parseNotificationBody(null).text).toBe("");
    expect(parseNotificationBody("").text).toBe("");
  });

  it("JSON bina t ke → plain-text fallback (body as-is)", () => {
    const raw = JSON.stringify({ u: 1 });
    const parsed = parseNotificationBody(raw);
    expect(parsed.text).toBe(raw);
    expect(parsed.targetUserId).toBeUndefined();
  });
});

// ---------- buildSupportDraft (user side) ----------

/**
 * API me generate hone wale saare support-relevant titles — realistic samples.
 * (source: apps/api me createNotification ke title patterns)
 */
const ALL_NOTIFICATION_TITLES: Array<{ title: string; body: string | null }> = [
  // Support team actions
  { title: 'Support ne "Living TV" ke liye firmware update push kiya', body: null },
  { title: 'Support ne "Kitchen Fan" ke stuck commands clear kiye', body: null },
  { title: "Support ne Living TV ON kiya", body: null },
  { title: "Support ne Bedroom AC OFF kiya", body: null },
  { title: 'Support ne board renamed kiya: Old Board → New Board', body: null },
  // Device / board events
  { title: "📡 Board offline: Main Gate", body: null },
  { title: "✅ Board online: Main Gate", body: null },
  { title: "📡 Living TV offline", body: null },
  { title: "✅ Living TV online", body: null },
  { title: '📲 "Living TV" pe firmware update push kiya', body: null },
  { title: "🛰️ Board renamed: Old Board → New Board", body: null },
  // Family safety
  { title: '👶 Child safety: "Living TV" band kiya', body: null },
  { title: '⏳ "Living TV" ka time khatam', body: null },
  // Schedule
  { title: "⏰ Schedule fired: Living TV ON", body: null },
  // Order
  { title: "📦 Order placed", body: "Order SW-12345 place ho gaya" },
  // Member
  { title: "👤 New member joined Sharma House", body: null },
];

/** Intentional exceptions — inhe draft nahi chahiye (open reply expected). */
const NO_DRAFT_TITLES = ["🛠️ Support ne message bheja"];

describe("buildSupportDraft — no template missed", () => {
  it.each(ALL_NOTIFICATION_TITLES.map((t) => [t.title, t.body]))(
    "har notification type ka draft milta hai: %s",
    (title, body) => {
      expect(typeof buildSupportDraft({ category: "support", title: title as string, body: body as string | null })).toBe(
        "string",
      );
    },
  );

  it.each(NO_DRAFT_TITLES)("intentional no-draft case: %s", (title) => {
    expect(buildSupportDraft({ category: "support", title, body: null })).toBeNull();
  });
});

describe("buildSupportDraft — template content", () => {
  const draftFor = (title: string, body: string | null = null) =>
    buildSupportDraft({ category: "support", title, body }) ?? "";

  it("Support ON/OFF → device name + action in draft", () => {
    expect(draftFor('Support ne "Living TV" ON kiya')).toContain("Living TV");
  });

  it("device offline → device name quoted", () => {
    expect(draftFor("📡 Living TV offline")).toContain('"Living TV"');
  });

  it("board online → board name", () => {
    expect(draftFor("✅ Board online: Main Gate")).toContain("Main Gate");
  });

  it("family safety (child) → device + context", () => {
    expect(draftFor('👶 Child safety: "Living TV" band kiya')).toContain("Living TV");
  });

  it("time khatam → device + dobara ON ka sawal", () => {
    expect(draftFor('⏳ "Living TV" ka time khatam')).toContain("Living TV");
  });

  it("schedule fired → device + action lowercase", () => {
    const d = draftFor("⏰ Schedule fired: Living TV ON");
    expect(d).toContain("Living TV");
    expect(d).toContain("on");
  });

  it("order placed → order number in draft (body se)", () => {
    const d = draftFor("📦 Order placed", "Order SW-12345 place ho gaya");
    expect(d).toContain("SW-12345");
  });

  it("member joined → home name", () => {
    expect(draftFor("👤 New member joined Sharma House")).toContain("Sharma House");
  });

  it("firmware update push → device name", () => {
    expect(draftFor('📲 "Living TV" pe firmware update push kiya')).toContain("Living TV");
  });

  it("board renamed → dono names", () => {
    const d = draftFor("🛰️ Board renamed: Old Board → New Board");
    expect(d).toContain("Old Board");
    expect(d).toContain("New Board");
  });

  it("unknown title → generic fallback with title", () => {
    const d = draftFor("🔮 Mystery event: something happened");
    expect(d).toContain("Mystery event: something happened");
  });

  it("null title/body → fallback (crash nahi)", () => {
    const d = buildSupportDraft({ category: "support", title: "", body: null });
    expect(typeof d).toBe("string");
    expect(d!.length).toBeGreaterThan(0);
  });
});

// ---------- buildAdminReplyDraft (admin side) ----------

describe("buildAdminReplyDraft", () => {
  it("user reply notification → user message quoted in template", () => {
    const d = buildAdminReplyDraft({
      category: "support",
      title: "📨 User ne support me reply kiya",
      body: JSON.stringify({ u: 42, t: "mera fan ON nahi ho raha" }),
    });
    expect(d).toContain("mera fan ON nahi ho raha");
    expect(d).toMatch(/Namaste/);
  });

  it("user reply with empty text → generic template", () => {
    const d = buildAdminReplyDraft({
      category: "support",
      title: "📨 User ne support me reply kiya",
      body: JSON.stringify({ u: 42, t: "" }),
    });
    expect(d).toContain("Namaste");
    expect(d).not.toContain('"');
  });

  it("user reply without JSON body → generic template", () => {
    const d = buildAdminReplyDraft({ category: "support", title: "📨 User ne support me reply kiya", body: null });
    expect(d).toContain("Namaste");
  });

  it("long user message → quote truncate (120 chars)", () => {
    const long = "x".repeat(200);
    const d = buildAdminReplyDraft({
      category: "support",
      title: "📨 User ne support me reply kiya",
      body: JSON.stringify({ u: 42, t: long }),
    });
    expect(d).toContain("x".repeat(120));
    expect(d).not.toContain("x".repeat(121));
  });

  it("non-user-reply title → null (koi draft nahi)", () => {
    expect(
      buildAdminReplyDraft({ category: "support", title: "🛠️ Support ne message bheja", body: null }),
    ).toBeNull();
  });
});

// ---------- Category independent (draft builders ko category nahi chahiye) ----------

describe("draft builders — category independence", () => {
  it("buildSupportDraft category se independent hai (device event kisi bhi category me)", () => {
    const d = buildSupportDraft({ category: "device", title: "📡 Living TV offline", body: null });
    expect(d).toContain("Living TV");
  });
});
