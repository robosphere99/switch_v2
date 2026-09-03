import { describe, expect, it } from "vitest";
import { esp32GuideHtml } from "./esp32Guide";
import { getOpenApiSpec } from "./openapi";

describe("ESP32 integration guide", () => {
  const html = esp32GuideHtml();
  const hindi = esp32GuideHtml("hi");

  it("documents har device endpoint (deviceApi.routes ke saath sync)", () => {
    const spec = getOpenApiSpec();
    const paths = spec.paths as Record<string, Record<string, unknown>>;
    const devicePaths = Object.keys(paths).filter((p) => p.startsWith("/api/device/"));
    expect(devicePaths.length).toBeGreaterThan(0);

    for (const p of devicePaths) {
      // URL-encode differences: spec me :params hain, guide me real values.
      const fragment = p.replace(/:\w+/g, "5");
      expect(html, `guide me ${p} missing`).toContain(fragment);
    }
  });

  it("har endpoint pe curl + python + node snippets hain", () => {
    const curlBlocks = html.match(/cURL/g)?.length ?? 0;
    const pythonBlocks = html.match(/Python \(requests\)/g)?.length ?? 0;
    const nodeBlocks = html.match(/Node\.js \(fetch\)/g)?.length ?? 0;
    // 6 device endpoints + api-key creation = 7 blocks each
    expect(curlBlocks).toBe(7);
    expect(pythonBlocks).toBe(7);
    expect(nodeBlocks).toBe(7);
  });

  it("Arduino sketch + base URL + auth section present", () => {
    expect(html).toContain("#include &lt;WiFi.h&gt;"); // HTML-escaped code block
    expect(html).toContain("pollCommands");
    expect(html).toContain("api_key");
    expect(html).toContain("onlineswitch.bhartitechnical.com");
    expect(html).toContain("Common errors");
  });

  it("api-key creation documented (rawKey sirf ek baar)", () => {
    expect(html).toContain("/api/api-keys/");
    expect(html).toContain("rawKey");
    expect(html).toContain("save karo");
  });

  it("Hindi version: Devanagari prose + language switcher", () => {
    expect(hindi).toContain("इंटीग्रेशन गाइड");
    expect(hindi).toContain("API key बनाएँ");
    expect(hindi).toContain("सभी devices");
    expect(hindi).toContain("मतलब");
    expect(hindi).toContain("उदाहरण response");
    expect(hindi).toContain(`href="/api/docs/esp32"`); // back to English
    expect(hindi).toContain("lang=\"hi\"");
    // English page pe Hindi link
    expect(html).toContain(`href="/api/docs/esp32/hi"`);
  });

  it("Hindi version: saare endpoints + snippets documented", () => {
    const spec = getOpenApiSpec();
    const paths = spec.paths as Record<string, Record<string, unknown>>;
    const devicePaths = Object.keys(paths).filter((p) => p.startsWith("/api/device/"));
    for (const p of devicePaths) {
      const fragment = p.replace(/:\w+/g, "5");
      expect(hindi, `Hindi guide me ${p} missing`).toContain(fragment);
    }
    expect(hindi.match(/cURL/g)?.length ?? 0).toBe(7);
    expect(hindi.match(/Python \(requests\)/g)?.length ?? 0).toBe(7);
    expect(hindi.match(/Node\.js \(fetch\)/g)?.length ?? 0).toBe(7);
    expect(hindi).toContain("#include &lt;WiFi.h&gt;");
    expect(hindi).toContain("pollCommands");
  });
});
