import { describe, expect, it } from "vitest";
import {
  buildMessage,
  couponLine,
  formatPriceCents,
  formatPriceLine,
} from "@/lib/dispatch/template";

describe("buildMessage", () => {
  it("substitutes placeholders", () => {
    const msg = buildMessage(
      "🔥 {{caption}}\n\n{{title}}\n\n{{coupon_line}}\npor {{price_line}}\n{{affiliate_url}}",
      {
        title: "Fone X",
        price: "R$ 10,00",
        affiliate_url: "https://aff.example/x",
        caption: "BORA COMPRAR",
        coupon_line: couponLine("PROMO10"),
        price_line: formatPriceLine(147500),
      },
    );
    expect(msg).toContain("🔥 BORA COMPRAR");
    expect(msg).toContain("Fone X");
    expect(msg).toContain("🏷️ Cupom: PROMO10");
    expect(msg).toContain("por 1.475,00");
    expect(msg).toContain("https://aff.example/x");
    expect(msg).not.toContain("{{");
  });

  it("collapses blank coupon_line cleanly without triple newlines", () => {
    const msg = buildMessage(
      "🔥 {{caption}}\n\n{{title}}\n\n{{coupon_line}}\npor {{price_line}}\n{{affiliate_url}}",
      {
        title: "Fone X",
        price: "R$ 10,00",
        affiliate_url: "https://aff.example/x",
        caption: "BORA COMPRAR",
        coupon_line: couponLine(null),
        price_line: formatPriceLine(147500),
      },
    );
    expect(msg).not.toContain("Cupom:");
    expect(msg).not.toMatch(/\n{3,}/);
    expect(msg).toBe(
      "🔥 BORA COMPRAR\n\nFone X\n\npor 1.475,00\nhttps://aff.example/x",
    );
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

describe("formatPriceLine", () => {
  it("formats pt-BR number without currency symbol", () => {
    expect(formatPriceLine(147500)).toBe("1.475,00");
    expect(formatPriceLine(1475)).toBe("14,75");
  });
  it("dash when null", () => {
    expect(formatPriceLine(null)).toBe("—");
  });
});
