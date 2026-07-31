import type { RawOffer } from "./types";

const DEFAULT_TIMEOUT_MS = 6_000;
const CONCURRENCY = 4;

function decideStatus(status: number): boolean | "retry-get" {
  if (status === 404 || status === 410) return false;
  if (status >= 200 && status < 400) return true;
  // 403/401/429: keep (anti-bot) — evita falso negativo em massa
  if (status === 401 || status === 403 || status === 429) return true;
  if (status === 405 || status === 501) return "retry-get";
  // outros 4xx/5xx: drop
  if (status >= 400) return false;
  return true;
}

async function probe(
  url: string,
  method: "HEAD" | "GET",
  timeoutMs: number,
): Promise<number | null> {
  try {
    const res = await fetch(url, {
      method,
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; GrupoDeVendaBot/1.0; +https://localhost)",
      },
    });
    return res.status;
  } catch {
    return null;
  }
}

/** true = keep offer; false = drop (404/dead/timeout). */
export async function isUrlAlive(
  url: string,
  opts?: { timeoutMs?: number },
): Promise<boolean> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const head = await probe(url, "HEAD", timeoutMs);
  if (head === null) {
    // rede/timeout no HEAD → tenta GET uma vez
    const get = await probe(url, "GET", timeoutMs);
    if (get === null) return false;
    return decideStatus(get) !== false;
  }
  const d = decideStatus(head);
  if (d === true) return true;
  if (d === false) return false;
  // retry-get
  const get = await probe(url, "GET", timeoutMs);
  if (get === null) return false;
  return decideStatus(get) !== false;
}

export async function filterAliveOffers(
  offers: RawOffer[],
  opts?: { timeoutMs?: number; concurrency?: number },
): Promise<RawOffer[]> {
  if (offers.length === 0) return [];
  const concurrency = opts?.concurrency ?? CONCURRENCY;
  const out: RawOffer[] = [];
  let i = 0;

  async function worker() {
    while (i < offers.length) {
      const idx = i++;
      const o = offers[idx];
      if (await isUrlAlive(o.url, opts)) out.push(o);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, offers.length) }, () =>
      worker(),
    ),
  );
  // preserve input order
  const alive = new Set(out.map((o) => o.url));
  return offers.filter((o) => alive.has(o.url));
}
