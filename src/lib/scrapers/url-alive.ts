import type { RawOffer } from "./types";

const DEFAULT_TIMEOUT_MS = 6_000;
const CONCURRENCY = 4;

/**
 * Veredito sobre o GET (medido em 2026-07-31):
 *   Amazon ASIN válido   → 200 sempre;  ASIN inexistente → 500 (4/5) ou 404 (1/5)
 *   ML / Shopee          → 200 para qualquer path (SPA); validação HTTP é cega lá,
 *                          a garantia vem de só colher href presente na página.
 * 401/403/429 falam do bot, não do recurso → mantém.
 */
function aliveByGet(status: number): boolean {
  if (status < 400) return true;
  if (status === 401 || status === 403 || status === 429) return true;
  return false;
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
    // não lemos o corpo; libera o socket em vez de deixar o GET baixar a página
    await res.body?.cancel().catch(() => {});
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
  if (head !== null) {
    if (head < 400) return true;
    if (head === 404 || head === 410) return false;
  }
  // HEAD inconclusivo (rede, 405, ou o 503 que a Amazon devolve a TODO HEAD —
  // inclusive de ASIN válido, o que antes derrubava a fonte inteira).
  const get = await probe(url, "GET", timeoutMs);
  if (get === null) return false;
  return aliveByGet(get);
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
