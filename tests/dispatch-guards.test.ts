import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  assertSessionConnected,
  assertGroupActive,
  assertOfferReady,
} from "@/lib/dispatch/guards";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/worker-client", () => ({
  getWorkerSession: vi.fn(),
}));

import { getWorkerSession } from "@/lib/worker-client";

function chainMock(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const m of [
    "select",
    "eq",
    "order",
    "limit",
    "in",
    "gte",
  ]) {
    chain[m] = self;
  }
  chain.maybeSingle = async () => result;
  return { from: () => chain } as unknown as SupabaseClient;
}

describe("assertSessionConnected", () => {
  beforeEach(() => {
    vi.mocked(getWorkerSession).mockReset();
  });

  it("fails when worker down", async () => {
    vi.mocked(getWorkerSession).mockResolvedValue({
      ok: false,
      error: "offline",
      status: 503,
    });
    const r = await assertSessionConnected();
    expect(r.ok).toBe(false);
  });

  it("fails when not connected", async () => {
    vi.mocked(getWorkerSession).mockResolvedValue({
      ok: true,
      data: { status: "qr", hasQr: true },
    });
    const r = await assertSessionConnected();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/qr/);
  });

  it("ok when connected", async () => {
    vi.mocked(getWorkerSession).mockResolvedValue({
      ok: true,
      data: { status: "connected", hasQr: false },
    });
    expect((await assertSessionConnected()).ok).toBe(true);
  });
});

describe("assertGroupActive", () => {
  it("rejects inactive", async () => {
    const r = await assertGroupActive(
      chainMock({
        data: { id: "g1", jid: "x@g.us", name: "G", active: false },
        error: null,
      }),
      "g1",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/inativo/i);
  });

  it("returns jid when active", async () => {
    const r = await assertGroupActive(
      chainMock({
        data: { id: "g1", jid: "x@g.us", name: "G", active: true },
        error: null,
      }),
      "g1",
    );
    expect(r.ok).toBe(true);
    if (r.ok && "jid" in r) expect(r.jid).toBe("x@g.us");
  });
});

describe("assertOfferReady", () => {
  it("fails without affiliate link", async () => {
    let calls = 0;
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const m of ["select", "eq", "order", "limit"]) chain[m] = self;
    chain.maybeSingle = async () => {
      calls += 1;
      if (calls === 1) {
        return {
          data: { id: "o1", title: "T", price_cents: 100, status: "approved" },
          error: null,
        };
      }
      return { data: null, error: null };
    };
    const supabase = { from: () => chain } as unknown as SupabaseClient;
    const r = await assertOfferReady(supabase, "o1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/afiliado/i);
  });
});
