import type { RawOffer, Scraper } from "./types";
import { scrapeOffersFromUrl } from "./firecrawl";

const DEFAULT_URL =
  process.env.SCRAPE_SHOPEE_URL || "https://shopee.com.br/flash_sale";

const PROMPT = `Extraia itens de oferta relâmpago / flash sale da Shopee Brasil.
Para cada item: title (nome), url (link absoluto do produto), priceCents (preço em centavos inteiros, ex: R$ 49,90 = 4990), imageUrl e externalId (itemid/shopid se visível).
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
  return scrapeOffersFromUrl(DEFAULT_URL, PROMPT);
}

export const shopeeScraper: Scraper = {
  source: "shopee",
  fetchOffers,
};
