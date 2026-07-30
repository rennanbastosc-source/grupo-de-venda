import { requireUser } from "@/lib/api-auth";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await ctx.params;
  const { data, error } = await auth.supabase
    .from("dispatch_jobs")
    .select(
      "id, offer_id, group_id, status, message_body, scheduled_for, sent_at, error, created_at, wa_groups(name, jid), offers(title)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Job não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ job: data });
}
