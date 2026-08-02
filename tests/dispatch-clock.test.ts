import { describe, expect, it } from "vitest";
import { dayStartInTz, DISPATCH_TZ } from "@/lib/dispatch/rate-limit";

describe("dayStartInTz (America/Fortaleza)", () => {
  it("fuso configurado é Fortaleza", () => {
    expect(DISPATCH_TZ).toBe("America/Fortaleza");
  });

  it("01:00 UTC ainda é o dia anterior em Fortaleza (caso 21h–00h)", () => {
    // 2026-08-02T01:00:00Z = 2026-08-01 22:00 em Fortaleza
    const start = dayStartInTz(new Date("2026-08-02T01:00:00Z"));
    expect(start.toISOString()).toBe("2026-08-01T03:00:00.000Z");
  });

  it("meio-dia UTC é o mesmo dia", () => {
    const start = dayStartInTz(new Date("2026-08-02T12:00:00Z"));
    expect(start.toISOString()).toBe("2026-08-02T03:00:00.000Z");
  });

  it("exatamente 03:00 UTC é a meia-noite local (virada)", () => {
    const start = dayStartInTz(new Date("2026-08-02T03:00:00Z"));
    expect(start.toISOString()).toBe("2026-08-02T03:00:00.000Z");
  });

  it("02:59 UTC pertence ao dia anterior", () => {
    const start = dayStartInTz(new Date("2026-08-02T02:59:00Z"));
    expect(start.toISOString()).toBe("2026-08-01T03:00:00.000Z");
  });
});
