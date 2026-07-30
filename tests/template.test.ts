import { describe, expect, it } from "vitest";
import {
  buildMessage,
  formatPriceCents,
} from "@/lib/dispatch/template";

describe("buildMessage", () => {
  it("substitutes placeholders", () => {
    const msg = buildMessage(
      "🔥 {{title}}\n💰 {{price}}\n🔗 {{affiliate_url}}",
      {
        title: "Fone X",
        price: "R$ 10,00",
        affiliate_url: "https://aff.example/x",
      },
    );
    expect(msg).toContain("Fone X");
    expect(msg).toContain("https://aff.example/x");
    expect(msg).not.toContain("{{");
  });
});

describe("formatPriceCents", () => {
  it("formats BRL", () => {
    expect(formatPriceCents(1990)).toMatch(/19/);
  });
  it("dash when null", () => {
    expect(formatPriceCents(null)).toBe("—");
  });
});
