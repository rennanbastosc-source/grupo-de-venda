import { describe, expect, it } from "vitest";
import {
  canonicalizeUrl,
  parsePriceToCents,
  parsePricesFromText,
} from "@/lib/scrapers/normalize";

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

describe("parsePricesFromText", () => {
  it("markup strip de tags: R$ 1.499 00 R$ 698 00 → original+atual", () => {
    expect(parsePricesFromText("R$ 1.499 00 R$ 698 00")).toEqual({
      priceCents: 69800,
      originalPriceCents: 149900,
    });
  });

  it("preço inteiro sem centavos (Shopee/vitrine)", () => {
    expect(parsePricesFromText("Fone Bluetooth R$ 698")).toEqual({
      priceCents: 69800,
    });
  });

  it("Mercado Livre: de/por clássico", () => {
    expect(
      parsePricesFromText("Smartphone de R$ 1.499,00 por R$ 698,00"),
    ).toEqual({ priceCents: 69800, originalPriceCents: 149900 });
  });

  it("Amazon: de/por e ignora parcela", () => {
    expect(
      parsePricesFromText(
        "Notebook i7 de R$ 3.499,00 por R$ 2.499,00 ou 10x de R$ 249,90",
      ),
    ).toEqual({ priceCents: 249900, originalPriceCents: 349900 });
  });

  it("não escolhe Pix/cashback/cupom após preço de vitrine", () => {
    expect(
      parsePricesFromText(
        "TV 55 R$ 1.999,00 R$ 1.499,00 no Pix R$ 1.399,00 cashback R$ 50,00 cupom R$ 30,00",
      ),
    ).toEqual({ priceCents: 149900, originalPriceCents: 199900 });
  });

  it("Shopee: dois preços com espaço-centavos e lixo de parcela", () => {
    expect(
      parsePricesFromText(
        "Relógio R$ 299 90 R$ 149 90 12x de R$ 12 49 no Pix R$ 140 00",
      ),
    ).toEqual({ priceCents: 14990, originalPriceCents: 29990 });
  });
});
