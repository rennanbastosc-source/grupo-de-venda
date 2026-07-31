import type { RawOffer } from "./types";
import { parsePricesFromText } from "./normalize";

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
    const title = cleanTitle(inner.slice(0, 200), href).slice(0, 240);
    const { priceCents, originalPriceCents } = parsePricesFromText(inner);
    out.push({ title, url: href, priceCents, originalPriceCents });
  }
  return out;
}

export function titleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const pathname = u.pathname.replace(/\/$/, "");
    const segments = pathname.split("/").filter(Boolean);

    // Se houver /dp/ASIN ou /gp/product/ASIN na URL
    const dpIdx = segments.findIndex(
      (s) => s.toLowerCase() === "dp" || s.toLowerCase() === "product",
    );
    if (dpIdx > 0) {
      const slug = segments[dpIdx - 1];
      if (slug) {
        return decodeURIComponent(slug).replace(/[-_+]/g, " ").slice(0, 240);
      }
    }

    const lastSeg = segments[segments.length - 1] || "";
    return decodeURIComponent(lastSeg).replace(/[-_+]/g, " ").slice(0, 240);
  } catch {
    return url.slice(0, 240);
  }
}

// Trata títulos incompletos/numéricos (ex: ASIN puro ou IDs da Amazon)
export function cleanTitle(title: string, url: string): string {
  const t = title.trim();
  if (!t || /^[A-Z0-9]{10}$/i.test(t) || /^[\d\s-_]+$/.test(t) || t.startsWith("http")) {
    const extracted = titleFromUrl(url);
    if (extracted && !/^[A-Z0-9]{10}$/i.test(extracted) && !/^[\d\s-_]+$/.test(extracted)) {
      return extracted;
    }
  }
  return t || titleFromUrl(url);
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
    byUrl.set(href, { title: cleanTitle("", href), url: href });
  }

  return [...byUrl.values()].slice(0, max);
}
