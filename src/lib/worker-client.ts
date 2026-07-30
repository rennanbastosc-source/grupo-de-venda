export type WorkerSession = {
  status: string;
  hasQr: boolean;
  hasPairingCode?: boolean;
  phone?: string | null;
  lastError?: string | null;
};

export type WorkerQr = {
  qrDataUrl: string | null;
};

export type WorkerPairingCode = {
  code: string | null;
  phone: string | null;
  at: number | null;
};

function workerConfig() {
  const base = process.env.WORKER_BASE_URL?.replace(/\/$/, "");
  const secret = process.env.WORKER_API_SECRET;
  return { base, secret };
}

export function isWorkerConfigured(): boolean {
  const { base, secret } = workerConfig();
  return Boolean(base && secret);
}

export async function workerFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const { base, secret } = workerConfig();
  if (!base || !secret) {
    return { ok: false, error: "Worker não configurado", status: 503 };
  }
  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-worker-secret": secret,
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error: text || `Worker HTTP ${res.status}`,
        status: res.status,
      };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Worker offline",
      status: 503,
    };
  }
}

export async function getWorkerSession() {
  return workerFetch<WorkerSession>("/session");
}

export async function getWorkerQr() {
  return workerFetch<WorkerQr>("/session/qr");
}

export async function getWorkerPairingCode() {
  return workerFetch<WorkerPairingCode>("/session/pairing-code");
}

export async function pairWorkerSession(phone: string) {
  return workerFetch<{ ok: boolean; phone?: string }>("/session/pair", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export async function logoutWorkerSession() {
  return workerFetch<{ ok: boolean }>("/session/logout", {
    method: "POST",
    body: "{}",
  });
}

export async function startWorkerSession() {
  return workerFetch<{ ok: boolean }>("/session/start", {
    method: "POST",
    body: "{}",
  });
}

export async function workerSend(input: {
  jid: string;
  text: string;
  jobId?: string;
}) {
  return workerFetch<{ ok: boolean; jobId?: string }>("/send", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
