import type { RawOffer, Scraper } from "./types";
import { scrapeOffersFromUrl } from "./firecrawl";
import { withSessionRetry } from "./session/ensure";

const DEFAULT_URL =
  process.env.SCRAPE_AMAZON_URL ||
  "https://www.amazon.com.br/deals";

const PROMPT = `Extraia produtos físicos individuais em promoção na Amazon Brasil.
Para cada item: title (nome completo do produto), url (link direto do produto contendo /dp/ASIN), priceCents (preço atual em centavos inteiros), imageUrl e externalId (ASIN).
ATENÇÃO: Ignore categorias de cupons (ex: "15% off em Ferramentas"), links de navegação e banners de departamento. Extraia apenas PRODUTOS FÍSICOS INDIVIDUAIS.
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
  return withSessionRetry("amazon", (session) =>
    scrapeOffersFromUrl(DEFAULT_URL, PROMPT, {
      headers: session.cookieHeader ? { Cookie: session.cookieHeader } : undefined,
    }),
  );
}

export const amazonScraper: Scraper = {
  source: "amazon",
  fetchOffers,
};
