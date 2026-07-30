import { describe, expect, it } from "vitest";
import { emitGeneric } from "@/lib/affiliates/providers/generic";
import { emitWithProvider } from "@/lib/affiliates/registry";
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
  it("fails when provider inactive", () => {
    const r = emitWithProvider(
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
