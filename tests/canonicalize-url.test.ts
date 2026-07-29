import { describe, expect, it } from "vitest";
import { canonicalizeUrl, parsePriceToCents } from "@/lib/scrapers/normalize";

describe("canonicalizeUrl", () => {
  it("strips tracking params and www", () => {
    const c = canonicalizeUrl(
      "https://www.mercadolivre.com.br/item?utm_source=x&id=1",
    );
    expect(c).toBe("https://mercadolivre.com.br/item?id=1");
  });

  it("normalizes amazon dp", () => {
    const c = canonicalizeUrl(
      "https://www.amazon.com.br/foo/dp/B0ABC12345/ref=sr_1?th=1",
    );
    expect(c).toBe("https://amazon.com.br/dp/B0ABC12345");
  });

  it("throws on invalid", () => {
    expect(() => canonicalizeUrl("not-a-url")).toThrow();
  });
});

describe("parsePriceToCents", () => {
  it("parses BR format", () => {
    expect(parsePriceToCents("R$ 1.299,90")).toBe(129990);
  });
});
