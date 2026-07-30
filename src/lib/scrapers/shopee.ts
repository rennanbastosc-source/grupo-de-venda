import type { RawOffer, Scraper } from "./types";
import { scrapeOffersFromUrl } from "./firecrawl";

const DEFAULT_URL =
  process.env.SCRAPE_SHOPEE_URL || "https://shopee.com.br/flash_sale";

const PROMPT = `Extraia ofertas da Shopee Brasil.
Para cada item: title (nome completo), url (link absoluto do produto na Shopee), priceCents (preço em centavos inteiros), imageUrl e externalId.
Importante: a url de cada produto deve ser a URL inteira real do produto (ex: https://shopee.com.br/nome-do-produto-i.SHOPID.ITEMID), não invente URLs genéricas ou mock.
Máximo 15 itens.`;

async function fetchOffers(): Promise<RawOffer[]> {
  if (process.env.SCRAPE_MOCK === "1") {
    return [
      {
        title: "Mock Shopee Oferta",
        url: "https://shopee.com.br/product/1/2",
        priceCents: 4990,
        externalId: "1-2",
      },
    ];
  }
  const offers = await scrapeOffersFromUrl(DEFAULT_URL, PROMPT);
  // ponytail: filtra URLs genéricas ou mock geradas pelo modelo quando bloqueado
  return offers.filter(
    (o) =>
      !o.url.endsWith("/fone-bluetooth") &&
      !o.url.endsWith("/smartphone-xyz") &&
      !o.url.endsWith("/produto1"),
  );
}

export const shopeeScraper: Scraper = {
  source: "shopee",
  fetchOffers,
};
