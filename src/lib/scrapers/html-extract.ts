import type { RawOffer } from "./types";
import { parsePriceToCents } from "./normalize";

export type ExtractOpts = {
  hostIncludes: string;
  hrefPattern: RegExp;
  max?: number;
};

/** Lightweight HTML link harvest — no cheerio. */
export function extractOffersFromHtml(
  html: string,
  baseUrl: string,
  opts: ExtractOpts,
): RawOffer[] {
  const max = opts.max ?? 20;
  const out: RawOffer[] = [];
  const seen = new Set<string>();
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && out.length < max) {
    let href = m[1];
    if (href.startsWith("//")) href = `https:${href}`;
    else if (href.startsWith("/")) {
      try {
        href = new URL(href, baseUrl).toString();
      } catch {
        continue;
      }
    }
    if (!href.includes(opts.hostIncludes)) continue;
    if (!opts.hrefPattern.test(href)) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    const inner = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const title = (inner.slice(0, 200) || titleFromUrl(href)).slice(0, 240);
    const priceCents = parsePriceToCents(inner);
    out.push({ title, url: href, priceCents });
  }
  return out;
}

export function titleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean).pop() || url;
    return decodeURIComponent(seg).replace(/[-_+]/g, " ").slice(0, 240);
  } catch {
    return url.slice(0, 240);
  }
}

/** Merge HTML harvest + raw link list; HTML titles win on same URL. */
export function harvestOffers(
  baseUrl: string,
  links: string[],
  html: string | undefined,
  opts: ExtractOpts,
): RawOffer[] {
  const max = opts.max ?? 15;
  const byUrl = new Map<string, RawOffer>();

  if (html) {
    for (const o of extractOffersFromHtml(html, baseUrl, { ...opts, max })) {
      byUrl.set(o.url, o);
    }
  }

  for (const raw of links) {
    if (byUrl.size >= max) break;
    let href = raw.trim();
    if (!href) continue;
    if (href.startsWith("//")) href = `https:${href}`;
    else if (href.startsWith("/")) {
      try {
        href = new URL(href, baseUrl).toString();
      } catch {
        continue;
      }
    }
    if (!href.includes(opts.hostIncludes)) continue;
    if (!opts.hrefPattern.test(href)) continue;
    if (byUrl.has(href)) continue;
    byUrl.set(href, { title: titleFromUrl(href), url: href });
  }

  return [...byUrl.values()].slice(0, max);
}
