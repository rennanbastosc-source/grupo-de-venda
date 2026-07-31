import { describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/offers/route";
import { PATCH } from "@/app/api/offers/[id]/route";

vi.mock("@/lib/api-auth", () => ({
  requireUser: vi.fn(),
}));

import { requireUser } from "@/lib/api-auth";

describe("Offers API Routes", () => {
  it("GET /api/offers returns 401 when unauthenticated", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      user: null,
      supabase: null as never,
      error: new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401 }),
    });

    const req = new Request("http://localhost/api/offers");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("POST /api/offers validates input", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      user: { id: "u1" } as never,
      supabase: {} as never,
      error: null,
    });

    const req = new Request("http://localhost/api/offers", {
      method: "POST",
      body: JSON.stringify({ title: "", url: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("title e url obrigatórios");
  });

  it("PATCH /api/offers/[id] validates status", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      user: { id: "u1" } as never,
      supabase: {} as never,
      error: null,
    });

    const req = new Request("http://localhost/api/offers/off-1", {
      method: "PATCH",
      body: JSON.stringify({ status: "invalid_status" }),
    });
    const ctx = { params: Promise.resolve({ id: "off-1" }) };
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("status deve ser approved | rejected | new");
  });
});
