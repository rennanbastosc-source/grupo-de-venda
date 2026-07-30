import { describe, expect, it } from "vitest";
import { isWaSessionStatus, mapSessionForUi } from "@/lib/wa/session";
import { maskPhone, normalizePhone } from "@/lib/wa/phone";

describe("mapSessionForUi", () => {
  it("maps connected as canDispatch", () => {
    const s = mapSessionForUi({ status: "connected", phone: "5511999999999" });
    expect(s.canDispatch).toBe(true);
    expect(s.hasQr).toBe(false);
    expect(s.phone).toBe("5511999999999");
  });

  it("disconnected without qr", () => {
    const s = mapSessionForUi({ status: "disconnected" });
    expect(s.status).toBe("disconnected");
    expect(s.canDispatch).toBe(false);
    expect(s.qrDataUrl).toBeNull();
  });

  it("waiting_pairing e logged_out válidos", () => {
    expect(mapSessionForUi({ status: "waiting_pairing" }).status).toBe(
      "waiting_pairing",
    );
    expect(mapSessionForUi({ status: "logged_out" }).canDispatch).toBe(false);
  });

  it("qr status with data url", () => {
    const s = mapSessionForUi({
      status: "qr",
      qrDataUrl: "data:image/png;base64,abc",
      pairingCode: "ABCD1234",
    });
    expect(s.hasQr).toBe(true);
    expect(s.qrDataUrl).toMatch(/^data:/);
    expect(s.pairingCode).toBe("ABCD1234");
    expect(s.hasPairingCode).toBe(true);
  });

  it("respects hasQr flag without data url", () => {
    const s = mapSessionForUi({ status: "qr", hasQr: true });
    expect(s.hasQr).toBe(true);
    expect(s.qrDataUrl).toBeNull();
  });

  it("falls back unknown status", () => {
    expect(mapSessionForUi({ status: "nope" }).status).toBe("disconnected");
  });
});

describe("isWaSessionStatus", () => {
  it("validates enum", () => {
    expect(isWaSessionStatus("connected")).toBe(true);
    expect(isWaSessionStatus("waiting_pairing")).toBe(true);
    expect(isWaSessionStatus("logged_out")).toBe(true);
    expect(isWaSessionStatus("x")).toBe(false);
  });
});

describe("normalizePhone / maskPhone", () => {
  it("normaliza BR", () => {
    expect(normalizePhone("(11) 99999-9999")).toBe("5511999999999");
    expect(normalizePhone("12")).toBeNull();
  });
  it("mascara últimos 4", () => {
    expect(maskPhone("5511999999999")).toMatch(/9999$/);
    expect(maskPhone(null)).toBe("—");
  });
});
