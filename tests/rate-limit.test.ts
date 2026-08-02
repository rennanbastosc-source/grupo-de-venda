import { describe, expect, it } from "vitest";
import { canSendNow, isWithinSleepWindow } from "@/lib/dispatch/rate-limit";

const settings = {
  daily_cap: 35,
  hourly_cap: 10,
  min_interval_sec: 45,
};

const under = { daily: 0, hourly: 0, lastSentAt: null };

describe("canSendNow", () => {
  it("allows when under caps", () => {
    expect(
      canSendNow(
        under,
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

  it("allows when sleep window disabled (null)", () => {
    const r = canSendNow(
      under,
      { ...settings, sleep_start: null, sleep_end: null },
      new Date("2026-07-29T12:00:00Z"),
    );
    expect(r.ok).toBe(true);
  });

  it("blocks simple sleep window 08:00–18:00 at 09:00 SP", () => {
    // 2026-07-29T12:00:00Z = 09:00 America/Sao_Paulo
    const r = canSendNow(
      under,
      { ...settings, sleep_start: "08:00", sleep_end: "18:00" },
      new Date("2026-07-29T12:00:00Z"),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toMatch(/descanso/i);
      expect(r.reason).toMatch(/08:00/);
      expect(r.reason).toMatch(/18:00/);
    }
  });

  it("allows outside simple sleep window at 21:00 SP", () => {
    // 2026-07-30T00:00:00Z = 21:00 America/Sao_Paulo
    const r = canSendNow(
      under,
      { ...settings, sleep_start: "08:00", sleep_end: "18:00" },
      new Date("2026-07-30T00:00:00Z"),
    );
    expect(r.ok).toBe(true);
  });

  it("blocks overnight sleep window 22:00–07:00 at 22:00 SP", () => {
    // 2026-07-29T01:00:00Z = 2026-07-28 22:00 America/Sao_Paulo
    const r = canSendNow(
      under,
      { ...settings, sleep_start: "22:00", sleep_end: "07:00" },
      new Date("2026-07-29T01:00:00Z"),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/descanso/i);
  });

  it("allows outside overnight sleep window at 09:00 SP", () => {
    // 2026-07-29T12:00:00Z = 09:00 America/Sao_Paulo
    const r = canSendNow(
      under,
      { ...settings, sleep_start: "22:00", sleep_end: "07:00" },
      new Date("2026-07-29T12:00:00Z"),
    );
    expect(r.ok).toBe(true);
  });

  // Janela operacional default da feature escala-disparos (Fortaleza UTC-3)
  const OPS = { ...settings, sleep_start: "23:01", sleep_end: "06:59" };

  it("bloqueia às 23:30 de Fortaleza", () => {
    // 2026-08-03T02:30:00Z = 2026-08-02 23:30 em Fortaleza
    expect(canSendNow(under, OPS, new Date("2026-08-03T02:30:00Z")).ok).toBe(
      false,
    );
  });

  it("bloqueia às 06:30 de Fortaleza", () => {
    // 2026-08-02T09:30:00Z = 06:30 em Fortaleza
    expect(canSendNow(under, OPS, new Date("2026-08-02T09:30:00Z")).ok).toBe(
      false,
    );
  });

  it("libera às 07:00 de Fortaleza", () => {
    // 2026-08-02T10:00:00Z = 07:00 em Fortaleza
    expect(canSendNow(under, OPS, new Date("2026-08-02T10:00:00Z")).ok).toBe(
      true,
    );
  });

  it("libera às 23:00 de Fortaleza (último slot do dia)", () => {
    // 2026-08-03T02:00:00Z = 2026-08-02 23:00 em Fortaleza
    expect(canSendNow(under, OPS, new Date("2026-08-03T02:00:00Z")).ok).toBe(
      true,
    );
  });
});

describe("isWithinSleepWindow", () => {
  it("false when start === end", () => {
    expect(
      isWithinSleepWindow(new Date("2026-07-29T12:00:00Z"), {
        ...settings,
        sleep_start: "10:00",
        sleep_end: "10:00",
      }),
    ).toBe(false);
  });

  it("false when invalid format", () => {
    expect(
      isWithinSleepWindow(new Date("2026-07-29T12:00:00Z"), {
        ...settings,
        sleep_start: "8:00",
        sleep_end: "18:00",
      }),
    ).toBe(false);
  });
});

