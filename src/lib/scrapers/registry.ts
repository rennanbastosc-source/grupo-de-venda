import { amazonScraper } from "./amazon";
import { mercadolivreScraper } from "./mercadolivre";
import { shopeeScraper } from "./shopee";
import type { ScrapeSource, Scraper } from "./types";

const scrapers: Scraper[] = [
  mercadolivreScraper,
  amazonScraper,
  shopeeScraper,
];

export function getScraper(source: Exclude<ScrapeSource, "manual">): Scraper {
  const s = scrapers.find((x) => x.source === source);
  if (!s) throw new Error(`Scraper desconhecido: ${source}`);
  return s;
}

/** Cron/pipeline ativo: MeLi + Amazon. Shopee fora — anti-bot/profile Firecrawl não estabilizou. */
export function listActiveScrapeSources(): Exclude<ScrapeSource, "manual">[] {
  // ponytail: reativar "shopee" quando profile scrape v2 deixar de devolver Login Necessário
  return ["mercadolivre", "amazon"];
}

export function listAllScrapeSources(): Exclude<ScrapeSource, "manual">[] {
  return scrapers.map((s) => s.source);
}
