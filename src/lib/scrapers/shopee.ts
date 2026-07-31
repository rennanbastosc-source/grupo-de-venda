import type { RawOffer, Scraper } from "./types";
import { scrapeOffersFromUrl } from "./firecrawl";
import { withSessionRetry } from "./session/ensure";

const DEFAULT_URL =
  process.env.SCRAPE_SHOPEE_URL || "https://shopee.com.br/flash_sale";

const HREF = /i\.\d+\.\d+|\/product\/\d+\/\d+/i;

// A Shopee bloqueia navegação anônima de datacenter ("Login Necessário") em
// toda página. Sem sessão de browser persistida no Firecrawl não há colheita.
const PROFILE = process.env.FIRECRAWL_SHOPEE_PROFILE?.trim();

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
  return withSessionRetry("shopee", (session) =>
    scrapeOffersFromUrl(DEFAULT_URL, {
      hostIncludes: "shopee.com.br",
      hrefPattern: HREF,
      waitFor: 6000,
      profile: PROFILE,
      headers: session.cookieHeader
        ? { Cookie: session.cookieHeader }
        : undefined,
    }),
  );
}

export const shopeeScraper: Scraper = {
  source: "shopee",
  fetchOffers,
};
