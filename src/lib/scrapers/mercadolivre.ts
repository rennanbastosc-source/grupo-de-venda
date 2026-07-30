import type { RawOffer, Scraper } from "./types";
import { scrapeOffersFromUrl } from "./firecrawl";

const DEFAULT_URL =
  process.env.SCRAPE_ML_URL ||
  "https://lista.mercadolivre.com.br/ofertas";

const PROMPT = `Extraia produtos em oferta desta página do Mercado Livre.
Para cada item: title (nome completo), url (link absoluto do produto), priceCents (preço em centavos inteiros, ex: R$ 99,90 = 9990), imageUrl e externalId (MLB… se houver).
Ignore anúncios de serviço e banners. Máximo 15 itens.`;

async function fetchOffers(): Promise<RawOffer[]> {
  if (process.env.SCRAPE_MOCK === "1") {
    return [
      {
        title: "Mock ML Oferta",
        url: "https://www.mercadolivre.com.br/mock-produto-ml/p/MLB123",
        priceCents: 9990,
        externalId: "MLB123",
      },
    ];
  }
  return scrapeOffersFromUrl(DEFAULT_URL, PROMPT);
}

export const mercadolivreScraper: Scraper = {
  source: "mercadolivre",
  fetchOffers,
};
