import type { RawOffer, Scraper } from "./types";
import { extractOffersFromHtml } from "./html-extract";

const DEFAULT_URL =
  process.env.SCRAPE_ML_URL ||
  "https://lista.mercadolivre.com.br/ofertas";

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
    if (!res.ok) throw new Error(`ML HTTP ${res.status}`);
    const html = await res.text();
    return extractOffersFromHtml(html, DEFAULT_URL, {
      hostIncludes: "mercadolivre.com",
      hrefPattern: /mercadolivre\.com\.(br|ar|mx)/i,
      max: 15,
    });
  } finally {
    clearTimeout(t);
  }
}

export const mercadolivreScraper: Scraper = {
  source: "mercadolivre",
  fetchOffers,
};
