import type { RawOffer, Scraper } from "./types";
import { scrapeOffersFromUrl } from "./firecrawl";
import { loadSession } from "./session/store";

const DEFAULT_URL =
  process.env.SCRAPE_SHOPEE_URL || "https://shopee.com.br/flash_sale";

const HREF = /i\.\d+\.\d+|\/product\/\d+\/\d+/i;

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

  // A Shopee bloqueia navegação anônima de datacenter ("Login Necessário") em
  // toda página — só o profile de browser logado do Firecrawl autentica.
  // Sem ele, falha rápido em vez de queimar 2 chamadas Firecrawl (~40s cada)
  // com retry fake de login.
  const profile = process.env.FIRECRAWL_SHOPEE_PROFILE?.trim();
  if (!profile) {
    throw new Error(
      "Shopee: FIRECRAWL_SHOPEE_PROFILE ausente — crie um profile logado no Firecrawl (browser) e configure a env",
    );
  }

  // Cookie header real da sessão salva no DB, se existir. O profile é o que
  // importa — cookies anônimos de handshake não autenticam na Shopee.
  const session = await loadSession("shopee");

  try {
    return await scrapeOffersFromUrl(DEFAULT_URL, {
      hostIncludes: "shopee.com.br",
      hrefPattern: HREF,
      waitFor: 6000,
      profile,
      headers: session?.cookieHeader
        ? { Cookie: session.cookieHeader }
        : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Login Necess[áa]rio/i.test(msg)) {
      throw new Error(
        `${msg} — relogue o profile "${profile}" no Firecrawl (browser)`,
      );
    }
    throw err;
  }
}

export const shopeeScraper: Scraper = {
  source: "shopee",
  fetchOffers,
};
