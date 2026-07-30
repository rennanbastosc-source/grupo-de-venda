import type { RawOffer, Scraper } from "./types";
import { scrapeOffersFromUrl } from "./firecrawl";

const DEFAULT_URL =
  process.env.SCRAPE_AMAZON_URL ||
  "https://www.amazon.com.br/gp/goldbox";

const PROMPT = `Extraia ofertas da página de ofertas/Goldbox da Amazon Brasil.
Para cada item: title (nome), url (link absoluto com /dp/ASIN), priceCents (preço em centavos inteiros), imageUrl e externalId (código ASIN de 10 caracteres).
Máximo 15 itens.`;

async function fetchOffers(): Promise<RawOffer[]> {
  if (process.env.SCRAPE_MOCK === "1") {
    return [
      {
        title: "Mock Amazon Oferta",
        url: "https://www.amazon.com.br/dp/B0MOCKASIN",
        priceCents: 14990,
        externalId: "B0MOCKASIN",
      },
    ];
  }
  return scrapeOffersFromUrl(DEFAULT_URL, PROMPT);
}

export const amazonScraper: Scraper = {
  source: "amazon",
  fetchOffers,
};
