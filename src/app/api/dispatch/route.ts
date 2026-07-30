import { requireUser } from "@/lib/api-auth";
import { enqueueDispatch } from "@/lib/dispatch/enqueue";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let q = auth.supabase
    .from("dispatch_jobs")
    .select(
      "id, offer_id, group_id, status, message_body, scheduled_for, sent_at, error, created_at, wa_groups(name, jid), offers(title)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ jobs: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const offerId = typeof body.offerId === "string" ? body.offerId : "";
  const groupIds = Array.isArray(body.groupIds)
    ? body.groupIds.filter((g: unknown) => typeof g === "string")
    : [];

  const result = await enqueueDispatch(auth.supabase, { offerId, groupIds });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json(result.result, { status: 201 });
}
