import type { RawOffer, Scraper } from "./types";
import { scrapeOffersFromUrl } from "./firecrawl";
import { withSessionRetry } from "./session/ensure";

const DEFAULT_URL =
  process.env.SCRAPE_AMAZON_URL ||
  "https://www.amazon.com.br/gp/goldbox";

const HREF =
  /\/dp\/[A-Z0-9]{10}|\/gp\/product\//i;

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
    scrapeOffersFromUrl(DEFAULT_URL, {
      hostIncludes: "amazon.com.br",
      hrefPattern: HREF,
      headers: session.cookieHeader
        ? { Cookie: session.cookieHeader }
        : undefined,
    }),
  );
}

export const amazonScraper: Scraper = {
  source: "amazon",
  fetchOffers,
};
