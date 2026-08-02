import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { makeSupabase, op, type Op } from "./helpers/fake-supabase";

vi.mock("@/lib/api-auth", () => ({
  requireUser: vi.fn(),
}));

import { requireUser } from "@/lib/api-auth";
import { GET } from "@/app/api/bot/events/route";

const EVENTS = [
  { id: 2, status: "connected", detail: null, at: "2026-08-02T12:00:00Z" },
  { id: 1, status: "connecting", detail: null, at: "2026-08-02T11:59:00Z" },
];

describe("GET /api/bot/events", () => {
  beforeEach(() => {
    vi.mocked(requireUser).mockReset();
  });

  it("401 sem auth", async () => {
    vi.mocked(requireUser).mockResolvedValue({
      user: null,
      supabase: null as never,
      error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }),
    });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("lista os últimos 50 em ordem decrescente", async () => {
    const captured: Op[][] = [];
    const supabase = makeSupabase((table, ops) => {
      if (table === "wa_connection_events") {
        captured.push(ops);
        return { data: EVENTS, error: null };
      }
      return { data: [], error: null };
    });
    vi.mocked(requireUser).mockResolvedValue({
      user: { id: "u1" } as never,
      supabase,
      error: null,
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { events: typeof EVENTS };
    expect(body.events).toHaveLength(2);
    expect(body.events[0].status).toBe("connected");

    const ops = captured[0];
    const order = op(ops, "order");
    expect(order?.args[0]).toBe("at");
    expect((order?.args[1] as { ascending: boolean }).ascending).toBe(false);
    expect(op(ops, "limit")?.args[0]).toBe(50);
  });

  it("erro do banco vira 500 com mensagem", async () => {
    const supabase = makeSupabase(() => ({
      data: null,
      error: { message: "boom" },
    }));
    vi.mocked(requireUser).mockResolvedValue({
      user: { id: "u1" } as never,
      supabase,
      error: null,
    });
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
