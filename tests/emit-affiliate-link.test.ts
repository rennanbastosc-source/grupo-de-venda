import { afterEach, describe, expect, it, vi } from "vitest";
import { emitGeneric } from "@/lib/affiliates/providers/generic";
import { emitWithProvider } from "@/lib/affiliates/registry";
import { emitAffiliateLink } from "@/lib/affiliates/emit";
import { assertOfferHasAffiliateLink } from "@/lib/affiliates/require-link";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("emitGeneric", () => {
  it("rewrites URL with template params", () => {
    const r = emitGeneric("https://shop.example/item?x=1", {
      template: "{{url}}",
      params: { tag: "gdv", utm_source: "test" },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const u = new URL(r.affiliateUrl);
    expect(u.searchParams.get("tag")).toBe("gdv");
    expect(u.searchParams.get("utm_source")).toBe("test");
    expect(u.searchParams.get("x")).toBe("1");
  });
});

describe("emitWithProvider", () => {
  it("fails when provider inactive", async () => {
    const r = await emitWithProvider(
      {
        kind: "generic",
        active: false,
        config: { template: "{{url}}", params: { tag: "x" } },
      },
      "https://a.com",
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/inativo/i);
  });
});

describe("emitWithProvider — mercadolivre", () => {
  const ML_URL = "https://www.mercadolivre.com.br/x/p/MLB1";
  const mlProvider = (params?: Record<string, string>) => ({
    kind: "mercadolivre" as const,
    active: true,
    config: { template: "{{url}}", params: params ?? {} },
  });

  // Página do portal que o provider faz GET para obter CSRF (fluxo real).
  const PORTAL_PAGE =
    "https://www.mercadolivre.com.br/afiliados/linkbuilder";
  const pageResponse = (csrfCookie: string, metaToken: string) => ({
    ok: true,
    status: 200,
    headers: { get: (name: string) => (name === "set-cookie" ? `_csrf=${csrfCookie}; Path=/` : null) },
    text: async () =>
      `<html><head><meta name="csrf-token" content="${metaToken}"/></head></html>`,
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ML_AFFILIATE_COOKIE;
    delete process.env.ML_AFFILIATE_TAG;
    delete process.env.ML_AFFILIATE_TOOL;
  });

  it("modo curto: GET página (csrf) → POST createLink e usa short_url", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        if (url === PORTAL_PAGE) return pageResponse("fresh-csrf-cookie", "meta-token-abc");
        return {
          ok: true,
          status: 200,
          json: async () => ({ urls: [{ short_url: "https://meli.la/ABC123" }] }),
        };
      }),
    );
    process.env.ML_AFFILIATE_COOKIE = "ssid=abc; _d2id=xyz";
    process.env.ML_AFFILIATE_TAG = "bare7263900";

    const r = await emitWithProvider(mlProvider(), ML_URL);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.affiliateUrl).toBe("https://meli.la/ABC123");

    // 2 chamadas: GET da página + POST createLink
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe(PORTAL_PAGE);
    expect(calls[1].url).toBe(
      "https://www.mercadolivre.com.br/affiliate-program/api/v2/affiliates/createLink",
    );
    const headers = calls[1].init!.headers as Record<string, string>;
    expect(headers["x-csrf-token"]).toBe("meta-token-abc");
    expect(headers["referer"]).toBe(PORTAL_PAGE);
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["accept"]).toBe("application/json, text/plain, */*");
    // cookie da sessão + _csrf fresco vindo do Set-Cookie da página
    expect(headers["cookie"]).toBe("ssid=abc; _d2id=xyz; _csrf=fresh-csrf-cookie");
    expect(JSON.parse(String(calls[1].init!.body))).toEqual({
      urls: [ML_URL],
      tag: "bare7263900",
    });
  });

  it("modo curto: página sem CSRF → ok false legível", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === PORTAL_PAGE)
          return { ok: true, status: 200, headers: { get: () => null }, text: async () => "<html></html>" };
        throw new Error("createLink não deveria ser chamado");
      }),
    );
    process.env.ML_AFFILIATE_COOKIE = "ssid=abc";
    process.env.ML_AFFILIATE_TAG = "bare7263900";

    const r = await emitWithProvider(mlProvider(), ML_URL);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/CSRF/i);
    expect(r.error).toMatch(/sessão expirada/i);
  });

  it("modo curto: createLink HTTP erro → ok false com erro legível", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === PORTAL_PAGE) return pageResponse("c1", "t1");
        return { ok: false, status: 403 };
      }),
    );
    process.env.ML_AFFILIATE_COOKIE = "ssid=abc";
    process.env.ML_AFFILIATE_TAG = "bare7263900";

    const r = await emitWithProvider(mlProvider(), ML_URL);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/createLink falhou/);
    expect(r.error).toMatch(/sessão do portal expirada/i);
  });

  it("modo curto: shape inesperado → ok false legível", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === PORTAL_PAGE) return pageResponse("c1", "t1");
        return { ok: true, status: 200, json: async () => ({}) };
      }),
    );
    process.env.ML_AFFILIATE_COOKIE = "ssid=abc";
    process.env.ML_AFFILIATE_TAG = "bare7263900";

    const r = await emitWithProvider(mlProvider(), ML_URL);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/short_url/);
  });

  it("modo público: sem cookie + tag/tool → link longo com matt_word/matt_tool, sem fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    process.env.ML_AFFILIATE_TAG = "bare7263900";
    process.env.ML_AFFILIATE_TOOL = "27444778";

    const r = await emitWithProvider(mlProvider(), ML_URL);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const u = new URL(r.affiliateUrl);
    expect(u.searchParams.get("matt_word")).toBe("bare7263900");
    expect(u.searchParams.get("matt_tool")).toBe("27444778");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("modo público: sem cookie e sem tag/tool → URL pura, sem fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const r = await emitWithProvider(mlProvider(), ML_URL);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.affiliateUrl).toBe(ML_URL);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("modo público: fallback de tag/tool vindo de config.params", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const r = await emitWithProvider(
      mlProvider({ matt_word: "bare7263900", matt_tool: "27444778" }),
      ML_URL,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const u = new URL(r.affiliateUrl);
    expect(u.searchParams.get("matt_word")).toBe("bare7263900");
    expect(u.searchParams.get("matt_tool")).toBe("27444778");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

function mockSupabase(rows: { id: string } | null) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    limit: () => chain,
    maybeSingle: async () => ({ data: rows, error: null }),
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

describe("assertOfferHasAffiliateLink", () => {
  it("true when ok link exists", async () => {
    expect(
      await assertOfferHasAffiliateLink(mockSupabase({ id: "1" }), "off-1"),
    ).toBe(true);
  });

  it("false when none", async () => {
    expect(
      await assertOfferHasAffiliateLink(mockSupabase(null), "off-1"),
    ).toBe(false);
  });
});

type OfferRow = { id: string; url: string; url_canonical: string | null };
type InsertedLink = {
  offer_id: string;
  original_url: string;
  affiliate_url: string;
  status: string;
};

function mockEmitSupabase(offer: OfferRow) {
  const inserted: InsertedLink[] = [];
  const from = (table: string) => {
    if (table === "offers") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: offer, error: null }),
          }),
        }),
      };
    }
    if (table === "affiliate_providers") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: "prov-1",
                slug: "livelo",
                name: "Livelo",
                kind: "livelo",
                config: { template: "{{url}}", params: { tag: "gdv" } },
                active: true,
              },
              error: null,
            }),
          }),
        }),
      };
    }
    return {
      insert: (row: InsertedLink) => ({
        select: () => ({
          single: async () => {
            inserted.push(row);
            return {
              data: {
                id: "link-1",
                affiliate_url: row.affiliate_url,
                status: row.status,
                error: null,
              },
              error: null,
            };
          },
        }),
      }),
    };
  };
  return { from, inserted } as unknown as SupabaseClient & {
    inserted: InsertedLink[];
  };
}

describe("emitAffiliateLink", () => {
  it("usa url_canonical como original_url quando presente", async () => {
    const supabase = mockEmitSupabase({
      id: "off-1",
      url: "https://mercadolivre.com.br/x/p/MLB1?pdp_filters=deal%3AMLB1&utm_source=foo",
      url_canonical: "https://mercadolivre.com.br/x/p/MLB1",
    });
    const res = await emitAffiliateLink(supabase, {
      offerId: "off-1",
      providerId: "prov-1",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const u = new URL(res.link.affiliate_url);
    expect(u.origin + u.pathname).toBe("https://mercadolivre.com.br/x/p/MLB1");
    expect(u.searchParams.get("pdp_filters")).toBeNull();
    expect(u.searchParams.get("utm_source")).toBe("livelo");
    expect(u.searchParams.get("tag")).toBe("gdv");
    expect(supabase.inserted[0].original_url).toBe(
      "https://mercadolivre.com.br/x/p/MLB1",
    );
  });

  it("cai no url cru quando url_canonical ausente", async () => {
    const supabase = mockEmitSupabase({
      id: "off-1",
      url: "https://mercadolivre.com.br/x/p/MLB1",
      url_canonical: null,
    });
    const res = await emitAffiliateLink(supabase, {
      offerId: "off-1",
      providerId: "prov-1",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(supabase.inserted[0].original_url).toBe(
      "https://mercadolivre.com.br/x/p/MLB1",
    );
  });
});
