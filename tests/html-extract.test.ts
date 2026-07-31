import { describe, expect, it } from "vitest";
import {
  cleanTitle,
  extractOffersFromHtml,
  harvestOffers,
  titleFromUrl,
} from "@/lib/scrapers/html-extract";

describe("html-extract", () => {
  it("extrai anchor Amazon /dp/ com título e preço", () => {
    const html = `
      <a href="https://www.amazon.com.br/dp/B0876MJBG6">Mouse Gamer R$ 99,90</a>
      <a href="https://www.amazon.com.br/b?node=1">Categoria</a>
    `;
    const offers = extractOffersFromHtml(
      html,
      "https://www.amazon.com.br/gp/goldbox",
      {
        hostIncludes: "amazon.com.br",
        hrefPattern: /\/dp\/[A-Z0-9]{10}/i,
      },
    );
    expect(offers).toHaveLength(1);
    expect(offers[0].url).toContain("/dp/B0876MJBG6");
    expect(offers[0].title).toMatch(/Mouse/);
    expect(offers[0].priceCents).toBe(9990);
  });

  it("harvest mescla links e html; html vence no título", () => {
    const offers = harvestOffers(
      "https://shopee.com.br/flash_sale",
      [
        "https://shopee.com.br/product/1/2",
        "https://shopee.com.br/flash_sale",
      ],
      `<a href="https://shopee.com.br/product/1/2">Fone Shopee</a>`,
      {
        hostIncludes: "shopee.com.br",
        hrefPattern: /\/product\/\d+\/\d+/i,
        max: 15,
      },
    );
    expect(offers).toHaveLength(1);
    expect(offers[0].title).toBe("Fone Shopee");
  });

  it("titleFromUrl extrai slug do produto da Amazon quando URL termina em ASIN", () => {
    const urlWithSlug = "https://www.amazon.com.br/Fone-de-Ouvido-Bluetooth-Sem-Fio/dp/B0876MJBG6";
    expect(titleFromUrl(urlWithSlug)).toBe("Fone de Ouvido Bluetooth Sem Fio");

    const urlDirectAsin = "https://www.amazon.com.br/dp/B0876MJBG6";
    expect(titleFromUrl(urlDirectAsin)).toBe("B0876MJBG6");
  });

  it("cleanTitle substitui títulos numéricos ou vazios pelo slug da URL da Amazon", () => {
    const urlWithSlug = "https://www.amazon.com.br/Fone-de-Ouvido-Bluetooth-Sem-Fio/dp/B0876MJBG6";
    expect(cleanTitle("135 4144914 5222909", urlWithSlug)).toBe("Fone de Ouvido Bluetooth Sem Fio");
    expect(cleanTitle("B0876MJBG6", urlWithSlug)).toBe("Fone de Ouvido Bluetooth Sem Fio");
  });
});
