import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/worker-client", () => ({
  workerFetch: vi.fn(),
}));

import { workerFetch } from "@/lib/worker-client";
import { processDispatchQueue } from "@/lib/dispatch/process";

function emptySupabase() {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const m of [
    "select",
    "eq",
    "order",
    "limit",
    "in",
    "gte",
    "update",
    "insert",
  ]) {
    chain[m] = self;
  }
  chain.maybeSingle = async () => ({ data: null, error: null });
  chain.then = undefined;
  return { from: () => chain } as unknown as SupabaseClient;
}

describe("processDispatchQueue session gate", () => {
  beforeEach(() => {
    vi.mocked(workerFetch).mockReset();
  });

  it("stoppedReason explícito e zero sends se desconectado", async () => {
    vi.mocked(workerFetch).mockResolvedValue({
      ok: true,
      data: { status: "disconnected" },
    });
    const r = await processDispatchQueue(emptySupabase(), { maxJobs: 3 });
    expect(r.sent).toBe(0);
    expect(r.processed).toBe(0);
    expect(r.stoppedReason).toMatch(/dashboard\/bot/i);
  });

  it("worker offline mensagem clara", async () => {
    vi.mocked(workerFetch).mockResolvedValue({
      ok: false,
      error: "ECONNREFUSED",
      status: 503,
    });
    const r = await processDispatchQueue(emptySupabase());
    expect(r.sent).toBe(0);
    expect(r.stoppedReason).toMatch(/Worker inacessível/i);
  });
});
