import { describe, expect, it } from "vitest";
import { dedupeOffers } from "@/lib/scrapers/dedupe";
import { normalizeRaw, runScrape, type OfferStore } from "@/lib/scrapers/run-pipeline";
import type { NormalizedOffer } from "@/lib/scrapers/types";

describe("dedupeOffers", () => {
  it("keeps first per source+canonical", () => {
    const a: NormalizedOffer = {
      source: "amazon",
      title: "A",
      url: "https://amazon.com.br/dp/B0A",
      urlCanonical: "https://amazon.com.br/dp/B0A",
    };
    const b = { ...a, title: "B" };
    expect(dedupeOffers([a, b])).toHaveLength(1);
  });
});

describe("normalizeRaw", () => {
  it("returns null without title", () => {
    expect(
      normalizeRaw("manual", { title: "  ", url: "https://x.com" }),
    ).toBeNull();
  });
});

describe("runScrape with mock store", () => {
  it("upserts without duplicate keys", async () => {
    process.env.SCRAPE_MOCK = "1";
    const keys = new Set<string>();
    let upserts = 0;
    const store: OfferStore = {
      async startRun() {
        return "run-1";
      },
      async finishRun() {},
      async upsertOffer(o) {
        const k = `${o.source}::${o.urlCanonical}`;
        if (keys.has(k)) return "skipped";
        keys.add(k);
        upserts += 1;
        return "inserted";
      },
    };
    // run twice same source
    const r1 = await runScrape(store, "mercadolivre");
    const r2 = await runScrape(store, "mercadolivre");
    expect(r1.found).toBeGreaterThan(0);
    expect(upserts).toBe(1);
    expect(r2.upserted).toBe(0);
    delete process.env.SCRAPE_MOCK;
  });
});
