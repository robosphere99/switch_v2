import { describe, expect, it } from "vitest";
import { REALTIME_EVENTS } from "@robosphere/shared";
import { realtimeGuideHtml } from "./realtimeGuide";

describe("Realtime (Socket.IO) guide", () => {
  const html = realtimeGuideHtml();

  it("har REALTIME_EVENTS event documented hai (shared package se sync)", () => {
    const names = Object.values(REALTIME_EVENTS);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(html, `guide me ${name} missing`).toContain(name);
    }
  });

  it("connection/auth + Node.js + browser snippets present", () => {
    expect(html).toContain("socket.io-client");
    expect(html).toContain("auth: { token:");
    expect(html).toContain("/socket.io/socket.io.js");
    expect(html).toContain("connect_error");
  });

  it("ESP32 polling model clearly distinguished (boards socket use nahi karte)", () => {
    expect(html).toContain("HTTP long-poll");
    expect(html).toContain("ESP32 boards isse connect NAHI hote");
  });

  it("command flow section present", () => {
    expect(html).toContain("Command flow");
    expect(html).toContain("command:updated");
    expect(html).toContain("device:updated");
  });
});
