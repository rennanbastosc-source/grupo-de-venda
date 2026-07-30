import type { RawOffer, Scraper } from "./types";
import { extractOffersFromHtml } from "./html-extract";

const DEFAULT_URL =
  process.env.SCRAPE_AMAZON_URL ||
  "https://www.amazon.com.br/gp/goldbox";

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
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(DEFAULT_URL, {
      signal: ctrl.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; GrupoDeVendaBot/0.1; +https://localhost)",
        "accept-language": "pt-BR,pt;q=0.9",
      },
    });
    if (!res.ok) throw new Error(`Amazon HTTP ${res.status}`);
    const html = await res.text();
    return extractOffersFromHtml(html, DEFAULT_URL, {
      hostIncludes: "amazon.com",
      hrefPattern: /\/dp\/[A-Z0-9]{10}/i,
      max: 15,
    });
  } finally {
    clearTimeout(t);
  }
}

export const amazonScraper: Scraper = {
  source: "amazon",
  fetchOffers,
};
