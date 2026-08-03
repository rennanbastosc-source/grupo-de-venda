import { workerFetch } from "@/lib/worker-client";

export type WorkerHealth = {
  ok: boolean;
  sessionStatus?: string;
  phone?: string | null;
  lastError?: string | null;
  uptimeSec?: number;
};

export type WakeResult = {
  healthOk: boolean;
  attempts: number;
  sessionStatus: string | null;
  started: boolean;
  lastError: string | null;
};

const DEFAULT_TRIES = 4;
const DEFAULT_GAP_MS = 3_000;

/**
 * Acorda o worker (Render free) e, se a sessão não estiver connected,
 * pede /session/start. Espera health ok entre tentativas.
 */
export async function wakeWorkerAndEnsureSession(opts?: {
  tries?: number;
  gapMs?: number;
  sleepFn?: (ms: number) => Promise<void>;
}): Promise<WakeResult> {
  const tries = opts?.tries ?? DEFAULT_TRIES;
  const gapMs = opts?.gapMs ?? DEFAULT_GAP_MS;
  const sleep =
    opts?.sleepFn ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  let healthOk = false;
  let sessionStatus: string | null = null;
  let lastError: string | null = null;
  let attempts = 0;
  let started = false;

  for (let i = 0; i < tries; i++) {
    attempts = i + 1;
    const health = await workerFetch<WorkerHealth>("/health");
    if (health.ok && health.data.ok) {
      healthOk = true;
      sessionStatus = health.data.sessionStatus ?? null;
      lastError = health.data.lastError ?? null;
      break;
    }
    lastError = health.ok
      ? "health ok=false"
      : health.error;
    if (i < tries - 1) await sleep(gapMs);
  }

  if (!healthOk) {
    return { healthOk, attempts, sessionStatus, started, lastError };
  }

  // sessão já boa
  if (sessionStatus === "connected") {
    return { healthOk, attempts, sessionStatus, started, lastError };
  }

  // tenta subir Baileys (creds existentes → reconnect; senão waiting_pairing)
  const start = await workerFetch<{ ok: boolean }>("/session/start", {
    method: "POST",
    body: "{}",
  });
  started = start.ok;
  if (!start.ok) {
    lastError = start.error;
  }

  // breve espera e re-lê status
  await sleep(Math.min(gapMs, 2_000));
  const session = await workerFetch<{
    status: string;
    lastError?: string | null;
  }>("/session");
  if (session.ok) {
    sessionStatus = session.data.status;
    lastError = session.data.lastError ?? lastError;
  }

  return { healthOk, attempts, sessionStatus, started, lastError };
}
