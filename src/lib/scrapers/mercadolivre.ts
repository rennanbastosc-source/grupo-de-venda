import type { RawOffer, Scraper } from "./types";
import { scrapeOffersFromUrl } from "./firecrawl";
import { withSessionRetry } from "./session/ensure";

const DEFAULT_URL =
  process.env.SCRAPE_ML_URL ||
  "https://www.mercadolivre.com.br/ofertas";

// /p/MLB…, /up/MLB…, ou path com MLB\d+
const HREF = /\/p\/MLB|\/up\/MLB|MLB\d+/i;

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
    scrapeOffersFromUrl(DEFAULT_URL, {
      hostIncludes: "mercadolivre.com.br",
      hrefPattern: HREF,
      headers: session.cookieHeader
        ? { Cookie: session.cookieHeader }
        : undefined,
    }),
  );
}

export const mercadolivreScraper: Scraper = {
  source: "mercadolivre",
  fetchOffers,
};
