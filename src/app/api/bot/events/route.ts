import { requireUser } from "@/lib/api-auth";
import { NextResponse } from "next/server";

/** Histórico de conexão do WhatsApp (append-only, escrito pelo worker). */
export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { data, error } = await auth.supabase
    .from("wa_connection_events")
    .select("id, status, detail, at")
    .order("at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ events: data ?? [] });
}
