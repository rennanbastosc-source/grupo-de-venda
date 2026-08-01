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

  it("extrai preço promocional e original de texto HTML", () => {
    const html = `
      <a href="https://www.amazon.com.br/dp/B0876MJBG6">Notebook i7 de R$ 3.499,00 por R$ 2.499,00 ou 10x de R$ 249,90</a>
    `;
    const offers = extractOffersFromHtml(
      html,
      "https://www.amazon.com.br",
      {
        hostIncludes: "amazon.com.br",
        hrefPattern: /\/dp\/[A-Z0-9]{10}/i,
      },
    );
    expect(offers).toHaveLength(1);
    expect(offers[0].priceCents).toBe(249900);
    expect(offers[0].originalPriceCents).toBe(349900);
  });

  it("preço após strip de tags (centavos em espaço) + ignora Pix", () => {
    // Simula HTML com spans que viram "R$ 1.499 00 R$ 698 00"
    const html = `
      <a href="https://produto.mercadolivre.com.br/MLB-123">
        Fone <span>R$</span><span>1.499</span><span>00</span>
        <span>R$</span><span>698</span><span>00</span>
        no Pix R$ 650 00
      </a>
    `;
    const offers = extractOffersFromHtml(
      html,
      "https://www.mercadolivre.com.br",
      {
        hostIncludes: "mercadolivre.com.br",
        hrefPattern: /MLB-/i,
      },
    );
    expect(offers).toHaveLength(1);
    expect(offers[0].priceCents).toBe(69800);
    expect(offers[0].originalPriceCents).toBe(149900);
  });

  it("cleanTitle substitui títulos numéricos ou vazios pelo slug da URL da Amazon", () => {
    const urlWithSlug = "https://www.amazon.com.br/Fone-de-Ouvido-Bluetooth-Sem-Fio/dp/B0876MJBG6";
    expect(cleanTitle("135 4144914 5222909", urlWithSlug)).toBe("Fone de Ouvido Bluetooth Sem Fio");
    expect(cleanTitle("B0876MJBG6", urlWithSlug)).toBe("Fone de Ouvido Bluetooth Sem Fio");
  });

  it("merge: anchor de título sem preço + anchor de preço com o MESMO href vira 1 oferta com priceCents", () => {
    const html = `
      <a href="https://produto.mercadolivre.com.br/p/MLB123">Fone Bluetooth X2</a>
      <a href="https://produto.mercadolivre.com.br/p/MLB123">
        <span class="andes-money-amount__currency-symbol">R$</span>
        <span class="andes-money-amount__fraction">59</span>
        <span class="andes-money-amount__cents">99</span>
      </a>
    `;
    const offers = extractOffersFromHtml(
      html,
      "https://www.mercadolivre.com.br",
      {
        hostIncludes: "mercadolivre.com.br",
        hrefPattern: /\/p\/MLB\d+/i,
      },
    );
    expect(offers).toHaveLength(1);
    expect(offers[0].title).toBe("Fone Bluetooth X2");
    expect(offers[0].priceCents).toBe(5999);
  });

  it("preço em DIV fora do anchor (estrutura real ML) preenche priceCents", () => {
    const html = `
      <a href="https://produto.mercadolivre.com.br/p/MLB1">Título</a>
      <div>
        <span class="andes-money-amount__currency-symbol">R$</span>
        <span class="andes-money-amount__fraction">59</span>
        <span class="andes-money-amount__cents">99</span>
      </div>
      <a href="https://produto.mercadolivre.com.br/p/MLB2">Outro Produto</a>
    `;
    const offers = extractOffersFromHtml(
      html,
      "https://www.mercadolivre.com.br",
      {
        hostIncludes: "mercadolivre.com.br",
        hrefPattern: /\/p\/MLB\d+/i,
      },
    );
    expect(offers).toHaveLength(2);
    expect(offers[0].url).toContain("/p/MLB1");
    expect(offers[0].title).toBe("Título");
    expect(offers[0].priceCents).toBe(5999);
    expect(offers[1].priceCents).toBeUndefined();
  });

  it("preço fora do anchor com 'de R$ X por R$ Y' preenche priceCents e originalPriceCents", () => {
    const html = `
      <a href="https://produto.mercadolivre.com.br/p/MLB7">Smartphone Turbo</a>
      <div>
        <span>de</span> <span class="andes-money-amount__currency-symbol">R$</span>
        <span class="andes-money-amount__fraction">1.499</span><span class="andes-money-amount__cents">00</span>
        <span>por</span> <span class="andes-money-amount__currency-symbol">R$</span>
        <span class="andes-money-amount__fraction">1.199</span><span class="andes-money-amount__cents">90</span>
      </div>
    `;
    const offers = extractOffersFromHtml(
      html,
      "https://www.mercadolivre.com.br",
      {
        hostIncludes: "mercadolivre.com.br",
        hrefPattern: /\/p\/MLB\d+/i,
      },
    );
    expect(offers).toHaveLength(1);
    expect(offers[0].priceCents).toBe(119990);
    expect(offers[0].originalPriceCents).toBe(149900);
  });
});
