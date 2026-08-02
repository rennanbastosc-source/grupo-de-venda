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

const SETTINGS = {
  daily_cap: 35,
  hourly_cap: 10,
  min_interval_sec: 45,
  daily_offer_cap: 10,
  sleep_start: null,
  sleep_end: null,
};

/**
 * Handler base do fluxo: reaper vazio, contadores zerados, um job na fila.
 */
function baseHandler(opts: {
  job?: Record<string, unknown> | null;
  stuck?: { id: string; attempts: number }[];
  updates: { table: string; payload: Record<string, unknown>; ops: Op[] }[];
}): Handler {
  return (table, ops) => {
    const upd = updatePayload(ops);
    if (upd) {
      opts.updates.push({ table, payload: upd, ops });
      if (upd.status === "sending") {
        // claim: .select("id").maybeSingle()
        return { data: { id: "j1" }, error: null };
      }
      return { data: null, error: null };
    }
    if (table === "app_settings") return { data: SETTINGS, error: null };
    if (table === "dispatch_jobs") {
      const sel = String(op(ops, "select")?.args[0] ?? "");
      if (sel.startsWith("id, attempts")) {
        return { data: opts.stuck ?? [], error: null };
      }
      if (op(ops, "select")?.args[1]) return { count: 0 };
      if (sel === "sent_at") return { data: null, error: null };
      if (sel === "offer_id") return { data: [], error: null };
      if (sel === "id, offer_id") {
        return {
          data: opts.job ? { id: "j1", offer_id: "o1" } : null,
          error: null,
        };
      }
      if (sel.startsWith("id, message_body")) {
        return { data: opts.job ? [opts.job] : [], error: null };
      }
    }
    return { data: null, error: null };
  };
}

function makeJob(attempts: number) {
  return {
    id: "j1",
    message_body: "msg",
    group_id: "g1",
    offer_id: "o1",
    attempts,
    wa_groups: { jid: "g@g.us", active: true },
  };
}

describe("retry com backoff", () => {
  beforeEach(() => {
    vi.mocked(workerFetch).mockReset();
    vi.mocked(workerFetch).mockImplementation(async (path: string) => {
      if (path === "/session") {
        return { ok: true, data: { status: "connected" } } as never;
      }
      return { ok: false, error: "boom", status: 500 } as never;
    });
  });

  it("falha transitória volta pra queued com attempts+1 e backoff", async () => {
    const updates: { table: string; payload: Record<string, unknown> }[] = [];
    const now = new Date("2026-08-02T12:00:00Z");
    const r = await processDispatchQueue(
      makeSupabase(baseHandler({ job: makeJob(0), updates: updates as never })),
      { now },
    );
    const requeue = updates.find(
      (u) => u.table === "dispatch_jobs" && u.payload.status === "queued",
    );
    expect(requeue).toBeDefined();
    expect(requeue?.payload.attempts).toBe(1);
    expect(requeue?.payload.claimed_at).toBeNull();
    const sched = new Date(String(requeue?.payload.scheduled_for));
    expect(sched.getTime()).toBeGreaterThan(now.getTime());
    expect(r.failed).toBe(0);
    expect(r.processed).toBe(1);
  });

  it("terceira falha é terminal com erro legível", async () => {
    const updates: { table: string; payload: Record<string, unknown> }[] = [];
    const r = await processDispatchQueue(
      makeSupabase(baseHandler({ job: makeJob(2), updates: updates as never })),
    );
    const failed = updates.find(
      (u) => u.table === "dispatch_jobs" && u.payload.status === "failed",
    );
    expect(failed).toBeDefined();
    expect(String(failed?.payload.error)).toMatch(/3 tentativas falharam/);
    expect(r.failed).toBe(1);
  });
});

describe("reaper de sending preso", () => {
  it("resgata pra queued com attempts+1", async () => {
    vi.mocked(workerFetch).mockReset();
    vi.mocked(workerFetch).mockResolvedValue({
      ok: true,
      data: { status: "connected" },
    } as never);
    const updates: {
      table: string;
      payload: Record<string, unknown>;
      ops: Op[];
    }[] = [];
    await processDispatchQueue(
      makeSupabase(
        baseHandler({
          job: null,
          stuck: [{ id: "stuck1", attempts: 0 }],
          updates,
        }),
      ),
    );
    const reap = updates.find((u) => u.payload.status === "queued");
    expect(reap).toBeDefined();
    expect(reap?.payload.attempts).toBe(1);
    // resgate condicionado a ainda estar sending (não sobrescreve corrida)
    const eqs = reap?.ops
      .filter((o) => o.method === "eq")
      .map((o) => o.args.join("="));
    expect(eqs).toContain("status=sending");
  });
});

describe("deduped do worker", () => {
  it("marca sent sem consumir rate limit", async () => {
    vi.mocked(workerFetch).mockReset();
    vi.mocked(workerFetch).mockImplementation(async (path: string) => {
      if (path === "/session") {
        return { ok: true, data: { status: "connected" } } as never;
      }
      return {
        ok: true,
        data: { ok: true, deduped: true },
      } as never;
    });
    const updates: { table: string; payload: Record<string, unknown> }[] = [];
    const r = await processDispatchQueue(
      makeSupabase(baseHandler({ job: makeJob(0), updates: updates as never })),
    );
    expect(r.sent).toBe(1);
    expect(
      updates.some(
        (u) => u.table === "dispatch_jobs" && u.payload.status === "sent",
      ),
    ).toBe(true);
    expect(
      updates.some(
        (u) => u.table === "offers" && u.payload.status === "sent",
      ),
    ).toBe(true);
    expect(r.stoppedReason).toBeUndefined();
  });
});
