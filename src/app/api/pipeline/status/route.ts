import { requireUser } from "@/lib/api-auth";
import { getWorkerSession } from "@/lib/worker-client";
import { NextResponse } from "next/server";

/** Status consolidado do pipeline para a UI de gestão manual. */
export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const supabase = auth.supabase;

  const [settingsRes, pendingCaptionRes, readyCaptionRes, failedCaptionRes,
    queuedRes, sentTodayRes, lastScrapeRes, session] = await Promise.all([
    supabase
      .from("app_settings")
      .select(
        "daily_cap, hourly_cap, min_interval_sec, message_template, auto_dispatch_enabled, auto_dispatch_group_ids, default_affiliate_provider_id, updated_at",
      )
      .eq("id", 1)
      .maybeSingle(),
    supabase
      .from("offers")
      .select("id", { count: "exact", head: true })
      .in("caption_status", ["pending", "none"])
      .in("status", ["new", "approved"]),
    supabase
      .from("offers")
      .select("id", { count: "exact", head: true })
      .eq("caption_status", "ready")
      .in("status", ["new", "approved"]),
    supabase
      .from("offers")
      .select("id", { count: "exact", head: true })
      .eq("caption_status", "failed")
      .in("status", ["new", "approved"]),
    supabase
      .from("dispatch_jobs")
      .select("id", { count: "exact", head: true })
      .in("status", ["queued", "sending"]),
    supabase
      .from("dispatch_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("sent_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
    supabase
      .from("scrape_runs")
      .select("source, started_at, finished_at, ok, items_found, items_upserted, error")
      .order("started_at", { ascending: false })
      .limit(5),
    getWorkerSession(),
  ]);

  return NextResponse.json({
    settings: settingsRes.data ?? null,
    counts: {
      captionsPending: pendingCaptionRes.count ?? 0,
      captionsReady: readyCaptionRes.count ?? 0,
      captionsFailed: failedCaptionRes.count ?? 0,
      jobsQueued: queuedRes.count ?? 0,
      sentLast24h: sentTodayRes.count ?? 0,
    },
    lastScrapeRuns: lastScrapeRes.data ?? [],
    sessionStatus: session.ok
      ? session.data.status
      : session.error || "indisponível",
  });
}
