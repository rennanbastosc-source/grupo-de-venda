import { describe, expect, it } from "vitest";
import {
  extractOffersFromHtml,
  harvestOffers,
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
});
