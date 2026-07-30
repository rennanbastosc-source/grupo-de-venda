import type { SupabaseClient } from "@supabase/supabase-js";
import { getWorkerSession } from "@/lib/worker-client";

export type OverviewStats = {
  date: string;
  dispatchesSent: number;
  dispatchesFailed: number;
  dispatchesQueued: number;
  dailyCap: number;
  hourlyCap: number;
  offersScrapedToday: number;
  sessionStatus: "disconnected" | "qr" | "connecting" | "connected";
  lastScrapeError: string | null;
};

/** Day bounds in America/Sao_Paulo as UTC ISO for timestamptz filters. */
export function dayBoundsSaoPaulo(now: Date = new Date()): {
  date: string;
  startIso: string;
  endIso: string;
} {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const date = fmt.format(now);
  // SP is UTC-3 year-round (no DST since 2019)
  const startIso = `${date}T03:00:00.000Z`;
  const next = new Date(`${date}T15:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const endStr = fmt.format(next);
  const endIso = `${endStr}T03:00:00.000Z`;
  return { date, startIso, endIso };
}

export function aggregateJobCounts(
  jobs: { status: string }[],
): Pick<
  OverviewStats,
  "dispatchesSent" | "dispatchesFailed" | "dispatchesQueued"
> {
  let dispatchesSent = 0;
  let dispatchesFailed = 0;
  let dispatchesQueued = 0;
  for (const j of jobs) {
    if (j.status === "sent") dispatchesSent += 1;
    else if (j.status === "failed") dispatchesFailed += 1;
    else if (j.status === "queued" || j.status === "sending") {
      dispatchesQueued += 1;
    }
  }
  return { dispatchesSent, dispatchesFailed, dispatchesQueued };
}

export async function getOverviewStats(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<OverviewStats> {
  const { date, startIso, endIso } = dayBoundsSaoPaulo(now);

  const [settingsRes, sentRes, failedRes, queuedRes, offersRes, scrapeRes, session] =
    await Promise.all([
      supabase
        .from("app_settings")
        .select("daily_cap, hourly_cap")
        .eq("id", 1)
        .maybeSingle(),
      supabase
        .from("dispatch_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "sent")
        .gte("sent_at", startIso)
        .lt("sent_at", endIso),
      supabase
        .from("dispatch_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed")
        .gte("created_at", startIso)
        .lt("created_at", endIso),
      supabase
        .from("dispatch_jobs")
        .select("id", { count: "exact", head: true })
        .in("status", ["queued", "sending"]),
      supabase
        .from("offers")
        .select("id", { count: "exact", head: true })
        .gte("scraped_at", startIso)
        .lt("scraped_at", endIso),
      supabase
        .from("scrape_runs")
        .select("error")
        .eq("ok", false)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      getWorkerSession(),
    ]);

  const sessionStatus = (
    session.ok &&
    ["disconnected", "qr", "connecting", "connected"].includes(
      session.data.status,
    )
      ? session.data.status
      : "disconnected"
  ) as OverviewStats["sessionStatus"];

  return {
    date,
    dispatchesSent: sentRes.count ?? 0,
    dispatchesFailed: failedRes.count ?? 0,
    dispatchesQueued: queuedRes.count ?? 0,
    dailyCap: settingsRes.data?.daily_cap ?? 35,
    hourlyCap: settingsRes.data?.hourly_cap ?? 10,
    offersScrapedToday: offersRes.count ?? 0,
    sessionStatus,
    lastScrapeError: scrapeRes.data?.error ?? null,
  };
}
