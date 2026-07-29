import { describe, expect, it } from "vitest";
import { isWaSessionStatus, mapSessionForUi } from "@/lib/wa/session";

describe("mapSessionForUi", () => {
  it("maps connected as canDispatch", () => {
    const s = mapSessionForUi({ status: "connected" });
    expect(s.canDispatch).toBe(true);
    expect(s.hasQr).toBe(false);
  });

  it("disconnected without qr", () => {
    const s = mapSessionForUi({ status: "disconnected" });
    expect(s.status).toBe("disconnected");
    expect(s.canDispatch).toBe(false);
    expect(s.qrDataUrl).toBeNull();
  });

  it("qr status with data url", () => {
    const s = mapSessionForUi({
      status: "qr",
      qrDataUrl: "data:image/png;base64,abc",
    });
    expect(s.hasQr).toBe(true);
    expect(s.qrDataUrl).toMatch(/^data:/);
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
    expect(isWaSessionStatus("x")).toBe(false);
  });
});
