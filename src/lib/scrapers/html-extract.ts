import type { RawOffer } from "./types";
import { parsePriceToCents } from "./normalize";

type ExtractOpts = {
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
    const title = inner.slice(0, 200) || href;
    const priceCents = parsePriceToCents(inner);
    out.push({ title, url: href, priceCents });
  }
  return out;
}
