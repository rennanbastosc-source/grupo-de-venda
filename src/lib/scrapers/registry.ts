import { amazonScraper } from "./amazon";
import { mercadolivreScraper } from "./mercadolivre";
import { magaluScraper, shopeeScraper } from "./stubs";
import type { ScrapeSource, Scraper } from "./types";

const scrapers: Scraper[] = [
  mercadolivreScraper,
  amazonScraper,
  shopeeScraper,
  magaluScraper,
];

export function getScraper(source: Exclude<ScrapeSource, "manual">): Scraper {
  const s = scrapers.find((x) => x.source === source);
  if (!s) throw new Error(`Scraper desconhecido: ${source}`);
  return s;
}

export function listActiveScrapeSources(): Exclude<ScrapeSource, "manual">[] {
  // MVP: only fully implemented sources run by default
  return ["mercadolivre", "amazon"];
}

export function listAllScrapeSources(): Exclude<ScrapeSource, "manual">[] {
  return scrapers.map((s) => s.source);
}
