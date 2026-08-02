import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

function makeClient(offers: Row[], settings: Row = {}) {
  const store = offers;
  const stats = { settingsReads: 0 };

  const filterRows = (
    rows: Row[],
    filters: { col: string; op: string; val: unknown }[],
  ) => {
    let out = rows;
    for (const f of filters) {
      if (f.op === "eq") out = out.filter((r) => r[f.col] === f.val);
      else if (f.op === "in") {
        const arr = f.val as unknown[];
        out = out.filter((r) => arr.includes(r[f.col]));
      } else if (f.op === "is") {
        out = out.filter((r) => r[f.col] == null);
      }
    }
    return out;
  };

  const from = (table: string) => {
    const filters: { col: string; op: string; val: unknown }[] = [];
    let limitN = 100;

    const chain: Record<string, unknown> = {};
    const self = () => chain;

    chain.select = () => self();
    chain.eq = (col: string, val: unknown) => {
      filters.push({ col, op: "eq", val });
      return self();
    };
    chain.in = (col: string, val: unknown) => {
      filters.push({ col, op: "in", val });
      return self();
    };
    chain.is = (col: string, val: unknown) => {
      filters.push({ col, op: "is", val });
      return self();
    };
    chain.order = () => self();
    chain.limit = (n: number) => {
      limitN = n;
      return self();
    };
    chain.maybeSingle = async () => {
      if (table === "app_settings") {
        stats.settingsReads += 1;
        return {
          data: {
            auto_dispatch_enabled: false,
            auto_dispatch_group_ids: [],
            default_affiliate_provider_id: null,
            ...settings,
          },
          error: null,
        };
      }
      if (table === "affiliate_links") {
        return { data: null, error: null };
      }
      const rows = filterRows(store, filters);
      return { data: rows[0] ?? null, error: null };
    };
    chain.update = (patch: Row) => {
      const uFilters: { col: string; op: string; val: unknown }[] = [];
      const uChain: Record<string, unknown> = {};
      const uSelf = () => uChain;
      uChain.eq = (col: string, val: unknown) => {
        uFilters.push({ col, op: "eq", val });
        return uSelf();
      };
      uChain.in = (col: string, val: unknown) => {
        uFilters.push({ col, op: "in", val });
        return uSelf();
      };
      uChain.select = () => uSelf();
      uChain.maybeSingle = async () => {
        const rows = filterRows(store, uFilters);
        for (const r of rows) Object.assign(r, patch);
        return { data: rows[0] ? { id: rows[0].id } : null, error: null };
      };
      // await supabase.from().update().eq() sem select
      uChain.then = (
        resolve: (v: { data: null; error: null }) => void,
      ) => {
        const rows = filterRows(store, uFilters);
        for (const r of rows) Object.assign(r, patch);
        resolve({ data: null, error: null });
      };
      return uChain;
    };
    // await supabase.from().select()...limit()
    chain.then = (resolve: (v: { data: Row[]; error: null }) => void) => {
      if (table === "offers") {
        resolve({
          data: filterRows(store, filters).slice(0, limitN),
          error: null,
        });
        return;
      }
      resolve({ data: [], error: null });
    };

    return chain;
  };

  return {
    client: { from } as unknown as SupabaseClient,
    stats,
  };
}

function offerRow(i: number): Row {
  const hex = i.toString(16).padStart(2, "0");
  return {
    id: `11111111-1111-4111-8111-1111111111${hex}`,
    title: `Oferta ${i}`,
    price_cents: 1000 + i,
    url: `https://ex.com/p/${i}`,
    source: "mercadolivre",
    status: "new",
    caption: null,
    caption_status: "none",
    updated_at: new Date().toISOString(),
    scraped_at: new Date().toISOString(),
  };
}

describe("runOfferPipeline", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("sem Sheets: gera caption mock e marca ready", async () => {
    vi.stubEnv("SCRAPE_MOCK", "1");
    const offer: Row = { ...offerRow(1), title: "Fone X" };
    const { client } = makeClient([offer]);
    const { runOfferPipeline } = await import("@/lib/pipeline/run");
    const result = await runOfferPipeline(client);

    expect(result.captioned).toBe(1);
    expect(offer.caption_status).toBe("ready");
    expect(String(offer.caption)).toContain("Fone X");
    expect(String(offer.caption)).not.toContain("http");
  });

  it("batch de caption segue daily_offer_cap", async () => {
    vi.stubEnv("SCRAPE_MOCK", "1");
    const offers = Array.from({ length: 15 }, (_, i) => offerRow(i));
    const { client } = makeClient(offers, { daily_offer_cap: 12 });
    const { runOfferPipeline } = await import("@/lib/pipeline/run");
    const result = await runOfferPipeline(client);
    expect(result.captioned).toBe(12);
  });

  it("cap ausente usa default 10", async () => {
    vi.stubEnv("SCRAPE_MOCK", "1");
    const offers = Array.from({ length: 15 }, (_, i) => offerRow(i));
    const { client } = makeClient(offers);
    const { runOfferPipeline } = await import("@/lib/pipeline/run");
    const result = await runOfferPipeline(client);
    expect(result.captioned).toBe(10);
  });

  it("teto duro de 25 por run protege o 9router", async () => {
    vi.stubEnv("SCRAPE_MOCK", "1");
    const offers = Array.from({ length: 30 }, (_, i) => offerRow(i));
    const { client } = makeClient(offers, { daily_offer_cap: 100 });
    const { runOfferPipeline } = await import("@/lib/pipeline/run");
    const result = await runOfferPipeline(client);
    expect(result.captioned).toBe(25);
  });

  it("app_settings é lido uma única vez por run", async () => {
    vi.stubEnv("SCRAPE_MOCK", "1");
    const { client, stats } = makeClient([offerRow(1)], {
      daily_offer_cap: 5,
    });
    const { runOfferPipeline } = await import("@/lib/pipeline/run");
    await runOfferPipeline(client);
    expect(stats.settingsReads).toBe(1);
  });
});
