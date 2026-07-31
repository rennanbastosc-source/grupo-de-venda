import type { RawOffer } from "./types";
import { harvestOffers } from "./html-extract";

const API = "https://api.firecrawl.dev/v1/scrape";

export type FirecrawlOffer = RawOffer;

export type ScrapeOffersOpts = {
  hostIncludes: string;
  hrefPattern: RegExp;
  max?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  waitFor?: number;
};

/**
 * Harvest product links from a marketplace page via Firecrawl links+html.
 * No LLM extract — only hrefs present on the page.
 */
export async function scrapeOffersFromUrl(
  targetUrl: string,
  opts: ScrapeOffersOpts,
): Promise<FirecrawlOffer[]> {
  const key = process.env.FIRECRAWL_API_KEY?.trim();
  if (!key) throw new Error("FIRECRAWL_API_KEY ausente");

  const max = opts.max ?? 15;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45_000);
  const signal = opts.signal ?? ctrl.signal;

  try {
    const payload: Record<string, unknown> = {
      url: targetUrl,
      formats: ["links", "html"],
      onlyMainContent: true,
      timeout: 40000,
    };

    if (opts.waitFor != null && opts.waitFor > 0) {
      payload.waitFor = opts.waitFor;
    }

    if (opts.headers && Object.keys(opts.headers).length > 0) {
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
      data?: { links?: unknown; html?: unknown };
    };

    const linksRaw = json.data?.links;
    const links = Array.isArray(linksRaw)
      ? linksRaw.filter((x): x is string => typeof x === "string")
      : [];
    const html =
      typeof json.data?.html === "string" ? json.data.html : undefined;

    return harvestOffers(targetUrl, links, html, {
      hostIncludes: opts.hostIncludes,
      hrefPattern: opts.hrefPattern,
      max,
    });
  } finally {
    clearTimeout(t);
  }
}
