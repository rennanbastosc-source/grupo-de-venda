import { requireUser } from "@/lib/api-auth";
import type { OfferStatus } from "@/lib/scrapers/types";
import { NextResponse } from "next/server";

const PATCHABLE = new Set<OfferStatus>(["approved", "rejected", "new"]);

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const status = body.status as OfferStatus;

  if (!PATCHABLE.has(status)) {
    return NextResponse.json(
      { error: "status deve ser approved | rejected | new" },
      { status: 400 },
    );
  }

  const { data, error } = await auth.supabase
    .from("offers")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Oferta não encontrada" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ offer: data });
}
