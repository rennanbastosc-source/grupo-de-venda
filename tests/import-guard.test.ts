import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/sheets/client", () => ({
  isSheetsConfigured: () => true,
  readRows: vi.fn(),
  appendRows: vi.fn(async () => ({ startRow: 100 })),
  updateRows: vi.fn(async () => {}),
}));
vi.mock("@/lib/ai/caption", () => ({
  generateCaption: vi.fn(async () => "Legenda nova sem URL"),
}));

import { readRows } from "@/lib/sheets/client";

type Row = Record<string, unknown>;

function makeClient(offers: Row[]) {
  const store = offers;

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
        return {
          data: {
            auto_dispatch_enabled: false,
            auto_dispatch_group_ids: [],
            default_affiliate_provider_id: null,
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
      return uChain;
    };
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

  return { from } as unknown as SupabaseClient;
}

const HEADER = ["id", "title", "price", "url", "source", "status", "caption", "caption_status"];

describe("importFromSheets guard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.mocked(readRows).mockReset();
  });

  it("não rebaixa oferta sent nem sobrescreve caption ready", async () => {
    const offer: Row = {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Fone X",
      price_cents: 1000,
      url: "https://ex.com/x",
      source: "mercadolivre",
      status: "sent",
      caption: "Caption gerada",
      caption_status: "ready",
      sheets_row: 2,
      updated_at: new Date().toISOString(),
      scraped_at: new Date().toISOString(),
    };
    vi.mocked(readRows).mockResolvedValue([
      HEADER,
      [
        "11111111-1111-4111-8111-111111111111",
        "Fone X",
        "R$ 10,00",
        "https://ex.com/x",
        "mercadolivre",
        "new", // stale na planilha — não deve rebaixar sent
        "Caption antiga da planilha",
        "ready",
      ],
    ]);
    const client = makeClient([offer]);
    const { runOfferPipeline } = await import("@/lib/pipeline/run");
    await runOfferPipeline(client);

    expect(offer.status).toBe("sent");
    expect(offer.caption).toBe("Caption gerada");
    expect(offer.caption_status).toBe("ready");
  });

  it("aplica edição humana em oferta ainda nova", async () => {
    const offer: Row = {
      id: "22222222-2222-4222-8222-222222222222",
      title: "Fone Y",
      price_cents: 2000,
      url: "https://ex.com/y",
      source: "mercadolivre",
      status: "new",
      caption: null,
      caption_status: "pending",
      sheets_row: 3,
      updated_at: new Date().toISOString(),
      scraped_at: new Date().toISOString(),
    };
    vi.mocked(readRows).mockResolvedValue([
      HEADER,
      [
        "22222222-2222-4222-8222-222222222222",
        "Fone Y",
        "R$ 20,00",
        "https://ex.com/y",
        "mercadolivre",
        "approved",
        "Caption editada pelo humano",
        "ready",
      ],
    ]);
    const client = makeClient([offer]);
    const { runOfferPipeline } = await import("@/lib/pipeline/run");
    await runOfferPipeline(client);

    expect(offer.status).toBe("approved");
    expect(offer.caption).toBe("Caption editada pelo humano");
    expect(offer.caption_status).toBe("ready");
  });
});
