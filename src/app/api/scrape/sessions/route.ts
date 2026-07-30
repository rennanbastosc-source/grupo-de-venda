import { requireUser } from "@/lib/api-auth";
import { listSessionStatuses } from "@/lib/scrapers/session/store";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const sessions = await listSessionStatuses(auth.supabase);
  return NextResponse.json({ sessions });
}
