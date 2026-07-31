import { dedupeOffers } from "./dedupe";
import { canonicalizeUrl } from "./normalize";
import { isProductOffer } from "./product-filter";
import { getScraper, listActiveScrapeSources } from "./registry";
import type { NormalizedOffer, RawOffer, ScrapeSource } from "./types";
import { filterAliveOffers } from "./url-alive";

export type OfferStore = {
  upsertOffer: (
    offer: NormalizedOffer,
  ) => Promise<"inserted" | "updated" | "skipped">;
  startRun: (source: ScrapeSource) => Promise<string>;
  finishRun: (
    id: string,
    result: {
      ok: boolean;
      itemsFound: number;
      itemsUpserted: number;
      error?: string;
    },
  ) => Promise<void>;
};

export function normalizeRaw(
  source: ScrapeSource,
  raw: RawOffer,
): NormalizedOffer | null {
  try {
    const urlCanonical = canonicalizeUrl(raw.url);
    const title = raw.title?.trim();
    if (!title) return null;
    return {
      source,
      title,
      url: raw.url.trim(),
      urlCanonical,
      priceCents: raw.priceCents,
      imageUrl: raw.imageUrl,
      externalId: raw.externalId,
    };
  } catch {
    return null;
  }
}

export async function runScrape(
  store: OfferStore,
  source?: Exclude<ScrapeSource, "manual">,
): Promise<{
  sources: ScrapeSource[];
  found: number;
  upserted: number;
  errors: string[];
}> {
  const sources = source ? [source] : listActiveScrapeSources();
  let found = 0;
  let upserted = 0;
  const errors: string[] = [];

  for (const src of sources) {
    const runId = await store.startRun(src);
    try {
      const scraper = getScraper(src);
      let raws = (await scraper.fetchOffers()).filter((r) =>
        isProductOffer(src, r),
      );
      // mock: sem HEAD externo
      if (process.env.SCRAPE_MOCK !== "1") {
        raws = await filterAliveOffers(raws);
      }
      found += raws.length;
      const normalized = dedupeOffers(
        raws
          .map((r) => normalizeRaw(src, r))
          .filter((x): x is NormalizedOffer => x !== null),
      );
      let up = 0;
      for (const o of normalized) {
        const r = await store.upsertOffer(o);
        if (r === "inserted" || r === "updated") up += 1;
      }
      upserted += up;
      await store.finishRun(runId, {
        ok: true,
        itemsFound: raws.length,
        itemsUpserted: up,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${src}: ${msg}`);
      await store.finishRun(runId, {
        ok: false,
        itemsFound: 0,
        itemsUpserted: 0,
        error: msg,
      });
    }
  }

  return { sources, found, upserted, errors };
}
