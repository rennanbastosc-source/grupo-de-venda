import { requireUser } from "@/lib/api-auth";
import { listSessionStatuses } from "@/lib/scrapers/session/store";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const [sessions, lastRunRes] = await Promise.all([
    listSessionStatuses(auth.supabase),
    auth.supabase
      .from("scrape_runs")
      .select("started_at, finished_at")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const lastRunAt = lastRunRes.data?.finished_at || lastRunRes.data?.started_at || null;

  return NextResponse.json({ sessions, lastRunAt });
}
