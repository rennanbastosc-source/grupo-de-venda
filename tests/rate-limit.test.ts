import { describe, expect, it } from "vitest";
import { canSendNow } from "@/lib/dispatch/rate-limit";

const settings = {
  daily_cap: 35,
  hourly_cap: 10,
  min_interval_sec: 45,
};

describe("canSendNow", () => {
  it("allows when under caps", () => {
    expect(
      canSendNow(
        { daily: 0, hourly: 0, lastSentAt: null },
        settings,
        new Date("2026-07-29T12:00:00Z"),
      ).ok,
    ).toBe(true);
  });

  it("blocks daily cap", () => {
    const r = canSendNow(
      { daily: 35, hourly: 0, lastSentAt: null },
      settings,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/diário/i);
  });

  it("blocks hourly cap", () => {
    const r = canSendNow(
      { daily: 1, hourly: 10, lastSentAt: null },
      settings,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/horário/i);
  });

  it("blocks min interval", () => {
    const now = new Date("2026-07-29T12:00:00Z");
    const r = canSendNow(
      {
        daily: 1,
        hourly: 1,
        lastSentAt: new Date("2026-07-29T11:59:30Z"),
      },
      settings,
      now,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Aguarde/i);
  });

  it("allows after interval", () => {
    const now = new Date("2026-07-29T12:01:00Z");
    expect(
      canSendNow(
        {
          daily: 1,
          hourly: 1,
          lastSentAt: new Date("2026-07-29T12:00:00Z"),
        },
        settings,
        now,
      ).ok,
    ).toBe(true);
  });
});
