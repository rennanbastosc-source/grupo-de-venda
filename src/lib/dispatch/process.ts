import type { SupabaseClient } from "@supabase/supabase-js";
import { workerFetch } from "@/lib/worker-client";
import { canSendNow, dayStartInTz, type RateSettings } from "./rate-limit";

export type ProcessResult = {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  stoppedReason?: string;
};

export type ProcessOpts = {
  /** Teto de envios do slot (grupos por burst). */
  maxJobs?: number;
  now?: Date;
  /** Injetável nos testes; produção usa setTimeout real. */
  sleepFn?: (ms: number) => Promise<void>;
};

const MAX_ATTEMPTS = 3;
const REAP_AFTER_MS = 10 * 60 * 1000;
const JITTER_MIN_MS = 2_000;
const JITTER_MAX_MS = 5_000;

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Resgata jobs presos em `sending` (função morreu entre o claim e o update
 * final). Com o dedupe durável no worker (wa_sent_jobs), reprocessar um job
 * já entregue é inofensivo — o worker responde deduped.
 */
async function reapStuckJobs(
  supabase: SupabaseClient,
  now: Date,
): Promise<void> {
  const cutoff = new Date(now.getTime() - REAP_AFTER_MS).toISOString();
  const { data: stuck } = await supabase
    .from("dispatch_jobs")
    .select("id, attempts")
    .eq("status", "sending")
    .or(`claimed_at.is.null,claimed_at.lt.${cutoff}`)
    .limit(20);

  for (const j of stuck ?? []) {
    await supabase
      .from("dispatch_jobs")
      .update({
        status: "queued",
        attempts: (j.attempts ?? 0) + 1,
        claimed_at: null,
      })
      .eq("id", j.id)
      .eq("status", "sending");
  }
}

async function loadSettings(supabase: SupabaseClient): Promise<RateSettings> {
  const { data } = await supabase
    .from("app_settings")
    .select(
      "daily_cap, hourly_cap, min_interval_sec, daily_offer_cap, sleep_start, sleep_end",
    )
    .eq("id", 1)
    .maybeSingle();
  return {
    daily_cap: data?.daily_cap ?? 35,
    hourly_cap: data?.hourly_cap ?? 10,
    min_interval_sec: data?.min_interval_sec ?? 45,
    daily_offer_cap: data?.daily_offer_cap ?? 10,
    sleep_start: data?.sleep_start ?? null,
    sleep_end: data?.sleep_end ?? null,
  };
}

async function countSentSince(
  supabase: SupabaseClient,
  sinceIso: string,
): Promise<number> {
  const { count } = await supabase
    .from("dispatch_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("sent_at", sinceIso);
  return count ?? 0;
}

async function lastSentAt(
  supabase: SupabaseClient,
): Promise<Date | null> {
  const { data } = await supabase
    .from("dispatch_jobs")
    .select("sent_at")
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.sent_at ? new Date(data.sent_at) : null;
}

/** Ofertas distintas já enviadas desde `sinceIso` (gate de ofertas/dia). */
async function countOffersSentSince(
  supabase: SupabaseClient,
  sinceIso: string,
): Promise<number> {
  const { data } = await supabase
    .from("dispatch_jobs")
    .select("offer_id")
    .eq("status", "sent")
    .gte("sent_at", sinceIso)
    .limit(1000);
  return new Set((data ?? []).map((r) => r.offer_id as string)).size;
}

/**
 * Um slot por execução: a oferta mais antiga da fila é enviada a todos os
 * seus grupos em sequência, com jitter 2–5s entre envios (ritmo humano).
 * A próxima oferta fica para o próximo slot do cron.
 */
export async function processDispatchQueue(
  supabase: SupabaseClient,
  opts: ProcessOpts = {},
): Promise<ProcessResult> {
  const clock = () => opts.now ?? new Date();
  const maxJobs = opts.maxJobs ?? 15;
  const sleep = opts.sleepFn ?? defaultSleep;
  const result: ProcessResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  const session = await workerFetch<{ status: string }>("/session");
  if (!session.ok || session.data.status !== "connected") {
    result.stoppedReason = session.ok
      ? "WhatsApp desconectado — reconecte em /dashboard/bot"
      : `Worker inacessível — ${session.error}`;
    return result;
  }

  await reapStuckJobs(supabase, clock());

  const settings = await loadSettings(supabase);
  const dayStart = dayStartInTz(clock());
  const hourStart = new Date(clock().getTime() - 60 * 60 * 1000);

  let daily = await countSentSince(supabase, dayStart.toISOString());
  let hourly = await countSentSince(supabase, hourStart.toISOString());
  const last = await lastSentAt(supabase);
  const dailyOffers = await countOffersSentSince(
    supabase,
    dayStart.toISOString(),
  );

  const gate = canSendNow(
    { daily, hourly, dailyOffers, lastSentAt: last },
    settings,
    clock(),
  );
  if (!gate.ok) {
    result.stoppedReason = gate.reason;
    return result;
  }

  // Slot: oferta do job queued mais antigo define o burst.
  const { data: head } = await supabase
    .from("dispatch_jobs")
    .select("id, offer_id")
    .eq("status", "queued")
    .lte("scheduled_for", clock().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!head) return result;

  const { data: burst } = await supabase
    .from("dispatch_jobs")
    .select(
      "id, message_body, group_id, offer_id, attempts, wa_groups(jid, active)",
    )
    .eq("status", "queued")
    .eq("offer_id", head.offer_id)
    .lte("scheduled_for", clock().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(50);

  const jobs = (burst ?? []).slice(0, maxJobs);

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];

    // teto de mensagens re-checado dentro do burst — estourou, o resto
    // permanece queued para o próximo dia/hora
    if (daily >= settings.daily_cap) {
      result.stoppedReason = `Teto diário (${settings.daily_cap}) atingido`;
      break;
    }
    if (hourly >= settings.hourly_cap) {
      result.stoppedReason = `Teto horário (${settings.hourly_cap}) atingido`;
      break;
    }

    const group = job.wa_groups as
      | { jid: string; active: boolean }
      | { jid: string; active: boolean }[]
      | null;
    const g = Array.isArray(group) ? group[0] : group;

    if (!g?.active) {
      await supabase
        .from("dispatch_jobs")
        .update({
          status: "skipped",
          error: "Grupo inativo",
        })
        .eq("id", job.id);
      result.processed += 1;
      result.skipped += 1;
      continue;
    }

    // claim atômico: só um cron vence se status ainda for queued
    const { data: claimed, error: claimErr } = await supabase
      .from("dispatch_jobs")
      .update({ status: "sending", claimed_at: clock().toISOString() })
      .eq("id", job.id)
      .eq("status", "queued")
      .select("id")
      .maybeSingle();
    if (claimErr || !claimed) continue;

    const send = await workerFetch<{ ok: boolean; deduped?: boolean }>(
      "/send",
      {
        method: "POST",
        body: JSON.stringify({
          jid: g.jid,
          text: job.message_body,
          jobId: job.id,
        }),
      },
    );

    result.processed += 1;

    if (!send.ok) {
      // Retry com backoff: falha transitória volta pra fila; só a
      // MAX_ATTEMPTS-ésima falha é terminal.
      const attempts = (job.attempts ?? 0) + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await supabase
          .from("dispatch_jobs")
          .update({
            status: "failed",
            error: `${attempts} tentativas falharam: ${send.error}`,
            attempts,
            claimed_at: null,
          })
          .eq("id", job.id);
        result.failed += 1;
      } else {
        await supabase
          .from("dispatch_jobs")
          .update({
            status: "queued",
            error: send.error,
            attempts,
            claimed_at: null,
            scheduled_for: new Date(
              clock().getTime() + 2 ** attempts * 60_000,
            ).toISOString(),
          })
          .eq("id", job.id);
      }
    } else {
      const sentAt = clock().toISOString();
      await supabase
        .from("dispatch_jobs")
        .update({
          status: "sent",
          sent_at: sentAt,
          error: null,
        })
        .eq("id", job.id);

      await supabase
        .from("offers")
        .update({ status: "sent", updated_at: sentAt })
        .eq("id", job.offer_id);

      result.sent += 1;
      if (!send.data.deduped) {
        // deduped = entrega antiga resgatada; a mensagem já contou no rate
        // quando foi de fato entregue.
        daily += 1;
        hourly += 1;
      }
    }

    // jitter humanizado entre grupos do mesmo burst
    if (i < jobs.length - 1) {
      await sleep(
        JITTER_MIN_MS + Math.random() * (JITTER_MAX_MS - JITTER_MIN_MS),
      );
    }
  }

  return result;
}
