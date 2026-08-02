import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/worker-client", () => ({
  workerFetch: vi.fn(),
}));

import { workerFetch } from "@/lib/worker-client";
import { processDispatchQueue } from "@/lib/dispatch/process";
import {
  makeSupabase,
  op,
  updatePayload,
  type Handler,
  type Op,
} from "./helpers/fake-supabase";

type Job = {
  id: string;
  message_body: string;
  group_id: string;
  offer_id: string;
  attempts: number;
  wa_groups: { jid: string; active: boolean };
};

function job(id: string, offerId = "o1", active = true): Job {
  return {
    id,
    message_body: "msg",
    group_id: `grp-${id}`,
    offer_id: offerId,
    attempts: 0,
    wa_groups: { jid: `${id}@g.us`, active },
  };
}

function burstHandler(opts: {
  jobs: Job[];
  settings?: Record<string, unknown>;
  sentOffersToday?: string[];
  updates: { table: string; payload: Record<string, unknown>; ops: Op[] }[];
  burstOps?: Op[][];
}): Handler {
  return (table, ops) => {
    const upd = updatePayload(ops);
    if (upd) {
      opts.updates.push({ table, payload: upd, ops });
      if (upd.status === "sending") {
        const id = ops.find((o) => o.method === "eq")?.args[1];
        return { data: { id }, error: null };
      }
      return { data: null, error: null };
    }
    if (table === "app_settings") {
      return {
        data: {
          daily_cap: 35,
          hourly_cap: 10,
          min_interval_sec: 45,
          daily_offer_cap: 10,
          sleep_start: null,
          sleep_end: null,
          ...(opts.settings ?? {}),
        },
        error: null,
      };
    }
    if (table === "dispatch_jobs") {
      const sel = String(op(ops, "select")?.args[0] ?? "");
      if (sel.startsWith("id, attempts")) return { data: [], error: null };
      if (op(ops, "select")?.args[1]) return { count: 0 };
      if (sel === "sent_at") return { data: null, error: null };
      if (sel === "offer_id") {
        return {
          data: (opts.sentOffersToday ?? []).map((o) => ({ offer_id: o })),
          error: null,
        };
      }
      if (sel === "id, offer_id") {
        const first = opts.jobs[0];
        return {
          data: first ? { id: first.id, offer_id: first.offer_id } : null,
          error: null,
        };
      }
      if (sel.startsWith("id, message_body")) {
        opts.burstOps?.push(ops);
        return { data: opts.jobs, error: null };
      }
    }
    return { data: null, error: null };
  };
}

function mockConnectedSendOk() {
  vi.mocked(workerFetch).mockReset();
  vi.mocked(workerFetch).mockImplementation(async (path: string) => {
    if (path === "/session") {
      return { ok: true, data: { status: "connected" } } as never;
    }
    return { ok: true, data: { ok: true } } as never;
  });
}

describe("burst broadcast com jitter", () => {
  beforeEach(() => mockConnectedSendOk());

  it("envia todos os jobs da oferta com jitter 2–5s entre grupos", async () => {
    const updates: { table: string; payload: Record<string, unknown> }[] = [];
    const sleeps: number[] = [];
    const r = await processDispatchQueue(
      makeSupabase(
        burstHandler({
          jobs: [job("j1"), job("j2"), job("j3")],
          updates: updates as never,
        }),
      ),
      { sleepFn: async (ms) => void sleeps.push(ms) },
    );
    expect(r.sent).toBe(3);
    expect(r.stoppedReason).toBeUndefined();
    // jitter entre grupos: N-1 pausas, todas dentro de [2000, 5000]
    expect(sleeps).toHaveLength(2);
    for (const ms of sleeps) {
      expect(ms).toBeGreaterThanOrEqual(2000);
      expect(ms).toBeLessThanOrEqual(5000);
    }
    const sent = updates.filter(
      (u) => u.table === "dispatch_jobs" && u.payload.status === "sent",
    );
    expect(sent).toHaveLength(3);
  });

  it("estouro de daily_cap no meio do burst interrompe e preserva a fila", async () => {
    const updates: { table: string; payload: Record<string, unknown> }[] = [];
    const r = await processDispatchQueue(
      makeSupabase(
        burstHandler({
          jobs: [job("j1"), job("j2"), job("j3")],
          settings: { daily_cap: 2 },
          updates: updates as never,
        }),
      ),
      { sleepFn: async () => {} },
    );
    expect(r.sent).toBe(2);
    expect(r.stoppedReason).toMatch(/Teto diário/);
    const sent = updates.filter(
      (u) => u.table === "dispatch_jobs" && u.payload.status === "sent",
    );
    expect(sent).toHaveLength(2);
    // j3 nunca foi claimado
    const claims = updates.filter((u) => u.payload.status === "sending");
    expect(claims).toHaveLength(2);
  });

  it("teto de ofertas/dia bloqueia o slot antes de qualquer claim", async () => {
    const updates: { table: string; payload: Record<string, unknown> }[] = [];
    const r = await processDispatchQueue(
      makeSupabase(
        burstHandler({
          jobs: [job("j1")],
          sentOffersToday: Array.from({ length: 10 }, (_, i) => `off-${i}`),
          updates: updates as never,
        }),
      ),
      { sleepFn: async () => {} },
    );
    expect(r.sent).toBe(0);
    expect(r.stoppedReason).toMatch(/ofertas por dia/i);
    expect(updates).toHaveLength(0);
  });

  it("burst consulta apenas jobs da oferta do slot", async () => {
    const updates: { table: string; payload: Record<string, unknown> }[] = [];
    const burstOps: Op[][] = [];
    await processDispatchQueue(
      makeSupabase(
        burstHandler({
          jobs: [job("j1", "oferta-x")],
          updates: updates as never,
          burstOps,
        }),
      ),
      { sleepFn: async () => {} },
    );
    expect(burstOps).toHaveLength(1);
    const eqs = burstOps[0]
      .filter((o) => o.method === "eq")
      .map((o) => o.args.join("="));
    expect(eqs).toContain("offer_id=oferta-x");
  });

  it("grupo inativo vira skipped sem derrubar o burst", async () => {
    const updates: { table: string; payload: Record<string, unknown> }[] = [];
    const r = await processDispatchQueue(
      makeSupabase(
        burstHandler({
          jobs: [job("j1", "o1", false), job("j2")],
          updates: updates as never,
        }),
      ),
      { sleepFn: async () => {} },
    );
    expect(r.skipped).toBe(1);
    expect(r.sent).toBe(1);
  });
});
