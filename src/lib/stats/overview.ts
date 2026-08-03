import type { SupabaseClient } from "@supabase/supabase-js";
import { getWorkerSession, workerFetch } from "@/lib/worker-client";

export type OverviewStats = {
  date: string;
  dispatchesSent: number;
  dispatchesFailed: number;
  dispatchesQueued: number;
  dailyCap: number;
  hourlyCap: number;
  offersScrapedToday: number;
  sessionStatus:
    | "disconnected"
    | "waiting_pairing"
    | "qr"
    | "connecting"
    | "connected"
    | "logged_out"
    | "offline";
  /** lastError do worker (/session ou /health) — legível no KPI */
  sessionLastError: string | null;
  /** GET /health ok (processo vivo no Render) */
  workerHealthOk: boolean;
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

const SESSION_STATUSES = new Set([
  "disconnected",
  "waiting_pairing",
  "qr",
  "connecting",
  "connected",
  "logged_out",
]);

export async function getOverviewStats(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<OverviewStats> {
  const { date, startIso, endIso } = dayBoundsSaoPaulo(now);

  const [
    settingsRes,
    sentRes,
    failedRes,
    queuedRes,
    offersRes,
    scrapeRes,
    session,
    health,
  ] = await Promise.all([
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
    workerFetch<{
      ok: boolean;
      sessionStatus?: string;
      lastError?: string | null;
    }>("/health"),
  ]);

  const workerHealthOk = health.ok && health.data.ok === true;

  let sessionStatus: OverviewStats["sessionStatus"] = "offline";
  let sessionLastError: string | null = null;

  if (session.ok && SESSION_STATUSES.has(session.data.status)) {
    sessionStatus = session.data.status as OverviewStats["sessionStatus"];
    sessionLastError = session.data.lastError ?? null;
  } else if (workerHealthOk && health.data.sessionStatus) {
    const hs = health.data.sessionStatus;
    sessionStatus = (SESSION_STATUSES.has(hs)
      ? hs
      : "disconnected") as OverviewStats["sessionStatus"];
    sessionLastError = health.data.lastError ?? null;
  } else if (!workerHealthOk) {
    sessionStatus = "offline";
    sessionLastError = health.ok
      ? "worker health ok=false"
      : health.error;
  } else {
    sessionStatus = "disconnected";
    sessionLastError = session.ok ? null : session.error;
  }

  return {
    date,
    dispatchesSent: sentRes.count ?? 0,
    dispatchesFailed: failedRes.count ?? 0,
    dispatchesQueued: queuedRes.count ?? 0,
    dailyCap: settingsRes.data?.daily_cap ?? 35,
    hourlyCap: settingsRes.data?.hourly_cap ?? 10,
    offersScrapedToday: offersRes.count ?? 0,
    sessionStatus,
    sessionLastError,
    workerHealthOk,
    lastScrapeError: scrapeRes.data?.error ?? null,
  };
}
