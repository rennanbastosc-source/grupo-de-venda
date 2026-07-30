import type { RawOffer } from "./types";

const API = "https://api.firecrawl.dev/v1/scrape";

const OFFER_SCHEMA = {
  type: "object",
  properties: {
    offers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          priceCents: { type: "number" },
          imageUrl: { type: "string" },
          externalId: { type: "string" },
        },
        required: ["title", "url"],
      },
    },
  },
  required: ["offers"],
} as const;

export type FirecrawlOffer = RawOffer;

function coercePriceCents(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return undefined;
  if (!Number.isInteger(v) || v < 500) {
    return Math.round(v * 100);
  }
  return Math.round(v);
}

export async function scrapeOffersFromUrl(
  targetUrl: string,
  prompt: string,
  opts?: { max?: number; signal?: AbortSignal; headers?: Record<string, string> },
): Promise<FirecrawlOffer[]> {
  const key = process.env.FIRECRAWL_API_KEY?.trim();
  if (!key) throw new Error("FIRECRAWL_API_KEY ausente");

  const max = opts?.max ?? 15;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45_000);
  const signal = opts?.signal ?? ctrl.signal;

  try {
    const payload: Record<string, unknown> = {
      url: targetUrl,
      formats: ["extract"],
      onlyMainContent: true,
      timeout: 40000,
      extract: {
        prompt,
        schema: OFFER_SCHEMA,
      },
    };

    if (opts?.headers && Object.keys(opts.headers).length > 0) {
      payload.headers = opts.headers;
    }

    const res = await fetch(API, {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Firecrawl HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      success?: boolean;
      data?: { extract?: { offers?: unknown[] } };
    };
    const raw = json.data?.extract?.offers;
    if (!Array.isArray(raw)) return [];

    const out: FirecrawlOffer[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const title = typeof o.title === "string" ? o.title.trim() : "";
      const url = typeof o.url === "string" ? o.url.trim() : "";
      if (!title || !url) continue;

      // ponytail: descarta links institucionais/menus da página
      const lower = title.toLowerCase();
      if (
        lower.includes("já tenho conta") ||
        lower.includes("sou novo") ||
        lower.includes("central de privacidade") ||
        lower.includes("termos de uso") ||
        lower.includes("minha conta") ||
        lower.includes("carrinho")
      ) {
        continue;
      }

      out.push({
        title: title.slice(0, 240),
        url,
        priceCents: coercePriceCents(o.priceCents ?? o.price),
        imageUrl:
          typeof o.imageUrl === "string" ? o.imageUrl : undefined,
        externalId:
          typeof o.externalId === "string" ? o.externalId : undefined,
      });
      if (out.length >= max) break;
    }
    return out;
  } finally {
    clearTimeout(t);
  }
}
