import type { RawOffer, Scraper } from "./types";
import { scrapeOffersFromUrl } from "./firecrawl";
import { withSessionRetry } from "./session/ensure";

const DEFAULT_URL =
  process.env.SCRAPE_ML_URL ||
  "https://www.mercadolivre.com.br/ofertas";

const PROMPT = `Extraia produtos físicos individuais em promoção nesta página do Mercado Livre.
Para cada item: title (nome completo do produto), url (link absoluto do produto com /p/MLB... ou /up/MLB...), priceCents (preço em centavos inteiros, ex: R$ 99,90 = 9990), imageUrl e externalId (MLB... se houver).
ATENÇÃO: Ignore links de conta ("Já tenho conta", "Sou novo"), suporte, central de privacidade, menu de navegação e banners. Extraia SOMENTE PRODUTOS FÍSICOS em oferta.
Máximo 15 itens.`;

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
  return withSessionRetry("mercadolivre", (session) =>
    scrapeOffersFromUrl(DEFAULT_URL, PROMPT, {
      headers: session.cookieHeader ? { Cookie: session.cookieHeader } : undefined,
    }),
  );
}

export const mercadolivreScraper: Scraper = {
  source: "mercadolivre",
  fetchOffers,
};
