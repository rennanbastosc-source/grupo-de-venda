import { describe, expect, it } from "vitest";

import { hasDispatchToday } from "@/lib/dispatch/guards";
import { makeSupabase, op, type Op } from "./helpers/fake-supabase";

/**
 * O guard faz duas consultas: pendentes (sem recorte de data) e sent do dia.
 * O handler responde por qual delas está sendo feita.
 */
function guardSupabase(opts: {
  pending?: boolean;
  sentToday?: boolean;
  seen?: Op[][];
}) {
  return makeSupabase((_table, ops) => {
    opts.seen?.push(ops);
    const status = op(ops, "in")?.args[1] as string[] | undefined;
    if (status) {
      return { data: opts.pending ? [{ id: "j1" }] : [], error: null };
    }
    return { data: opts.sentToday ? [{ id: "j2" }] : [], error: null };
  });
}

describe("hasDispatchToday", () => {
  it("bloqueia quando há job pendente, mesmo criado em outro dia", async () => {
    const seen: Op[][] = [];
    const r = await hasDispatchToday(
      guardSupabase({ pending: true, seen }),
      "o1",
      "g1",
    );
    expect(r).toBe(true);
    // a consulta de pendentes não pode recortar por data
    const pendingOps = seen[0];
    expect(pendingOps.some((o) => o.method === "gte")).toBe(false);
  });

  it("bloqueia quando a oferta já foi enviada hoje", async () => {
    const r = await hasDispatchToday(
      guardSupabase({ sentToday: true }),
      "o1",
      "g1",
    );
    expect(r).toBe(true);
  });

  it("libera quando não há pendente nem envio de hoje", async () => {
    const r = await hasDispatchToday(guardSupabase({}), "o1", "g1");
    expect(r).toBe(false);
  });

  // §14.6 caso 3: sent ontem não bloqueia re-enqueue no dia Fortaleza atual
  // (mock sentToday:false = consulta gte dayStart vazia → só havia sent antigo)
  it("libera re-enqueue no dia seguinte após sent ontem", async () => {
    const r = await hasDispatchToday(
      guardSupabase({ pending: false, sentToday: false }),
      "o1",
      "g1",
    );
    expect(r).toBe(false);
  });

  it("consulta de sent recorta pelo início do dia", async () => {
    const seen: Op[][] = [];
    await hasDispatchToday(guardSupabase({ seen }), "o1", "g1");
    const sentOps = seen[1];
    expect(sentOps.some((o) => o.method === "gte" && o.args[0] === "sent_at")).toBe(
      true,
    );
  });

  // §14.6 caso 1 (redundante com o primeiro it, nome explícito p/ regressão)
  it("bloqueia irmão se queued de ontem ainda existe (sem filtro de data)", async () => {
    const seen: Op[][] = [];
    const r = await hasDispatchToday(
      guardSupabase({ pending: true, seen }),
      "o1",
      "g1",
    );
    expect(r).toBe(true);
    expect(seen[0].some((o) => o.method === "gte")).toBe(false);
  });
});
