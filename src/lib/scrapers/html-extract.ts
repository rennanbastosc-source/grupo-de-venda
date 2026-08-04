import type { RawOffer } from "./types";
import { parseCouponFromText, parsePricesFromText } from "./normalize";

export type ExtractOpts = {
  hostIncludes: string;
  hrefPattern: RegExp;
  max?: number;
};

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function isWeakTitle(title: string): boolean {
  const t = title.trim();
  return !t || /^[A-Z0-9]{10}$/i.test(t) || /^[\d\s-_]+$/.test(t) || t.startsWith("http");
}

/** Janela HTML após o anchor: até o próximo `<a` ou ~limit chars (preço em DIV separado, ex: ML). */
function neighborWindow(html: string, start: number, limit = 1400): string {
  const slice = html.slice(start, start + limit);
  const nextA = slice.search(/<a\b/i);
  // Se o próximo <a> vem cedo demais (<80), o preço costuma estar DEPOIS do card
  // vizinho — não corta; senão corta no próximo link de produto.
  if (nextA >= 0 && nextA >= 80) return slice.slice(0, nextA);
  return slice;
}

/** Href variants para achar o card no HTML (links Firecrawl vs href relativo). */
function hrefSearchKeys(url: string, baseUrl: string): string[] {
  const keys: string[] = [url];
  try {
    const u = new URL(url, baseUrl);
    keys.push(u.pathname);
    keys.push(`${u.origin}${u.pathname}`);
    // ML: /p/MLB… e path com MLB-… no slug
    const mlb = u.pathname.match(/MLB-?\d+/i);
    if (mlb) keys.push(mlb[0]);
  } catch {
    /* ignore */
  }
  return [...new Set(keys.filter((k) => k.length > 3))];
}

/**
 * Ofertas vindas só da lista `links` do Firecrawl chegam sem priceCents.
 * Re-varre o HTML em torno do href (janela maior) e preenche preço faltante.
 */
export function enrichMissingPrices(
  offers: RawOffer[],
  html: string | undefined,
  baseUrl: string,
): RawOffer[] {
  if (!html || offers.length === 0) return offers;
  return offers.map((o) => {
    let priceCents = o.priceCents;
    let originalPriceCents = o.originalPriceCents;
    let coupon = o.coupon;

    for (const key of hrefSearchKeys(o.url, baseUrl)) {
      let from = 0;
      // até 3 ocorrências do mesmo href (título + preço + imagem)
      for (let n = 0; n < 3; n++) {
        const pos = html.indexOf(key, from);
        if (pos < 0) break;
        const start = Math.max(0, pos - 120);
        const windowHtml = html.slice(start, pos + 1600);
        const text = stripTags(windowHtml);
        if (priceCents == null) {
          const parsed = parsePricesFromText(text);
          if (parsed.priceCents != null) {
            priceCents = parsed.priceCents;
            if (parsed.originalPriceCents != null) {
              originalPriceCents = parsed.originalPriceCents;
            }
          }
        }
        if (!coupon) {
          coupon = parseCouponFromText(text);
        }
        if (priceCents != null && coupon != null) break;
        from = pos + key.length;
      }
      if (priceCents != null && coupon != null) break;
    }
    if (priceCents === o.priceCents && originalPriceCents === o.originalPriceCents && coupon === o.coupon) {
      return o;
    }
    return {
      ...o,
      priceCents: priceCents ?? o.priceCents,
      originalPriceCents: originalPriceCents ?? o.originalPriceCents,
      coupon: coupon ?? o.coupon,
    };
  });
}

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
  while ((m = re.exec(html)) !== null) {
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

    const inner = stripTags(m[2]);

    // href já visto (ex: anchor de preço após o de título): enriquece a oferta existente
    if (seen.has(href)) {
      const existing = out.find((o) => o.url === href);
      if (existing) {
        if (existing.priceCents == null) {
          const { priceCents, originalPriceCents } = parsePricesFromText(inner);
          if (priceCents != null) {
            existing.priceCents = priceCents;
            if (originalPriceCents != null) {
              existing.originalPriceCents = originalPriceCents;
            }
          }
        }
        if (!existing.coupon) {
          existing.coupon = parseCouponFromText(inner);
        }
        if (isWeakTitle(existing.title)) {
          existing.title = cleanTitle(inner.slice(0, 200), href).slice(0, 240);
        }
      }
      continue;
    }
    seen.add(href);

    const title = cleanTitle(inner.slice(0, 200), href).slice(0, 240);
    const { priceCents, originalPriceCents } = parsePricesFromText(inner);
    const coupon = parseCouponFromText(inner);
    const offer: RawOffer = { title, url: href, priceCents, originalPriceCents, coupon };

    // Preço ou cupom costuma ficar fora do `<a>` (DIV separado com spans em ML/Shopee)
    if (offer.priceCents == null || !offer.coupon) {
      const windowHtml = neighborWindow(html, m.index + m[0].length);
      const text = stripTags(windowHtml);
      if (offer.priceCents == null) {
        const neighborPrices = parsePricesFromText(text);
        if (neighborPrices.priceCents != null) {
          offer.priceCents = neighborPrices.priceCents;
          if (neighborPrices.originalPriceCents != null) {
            offer.originalPriceCents = neighborPrices.originalPriceCents;
          }
        }
      }
      if (!offer.coupon) {
        offer.coupon = parseCouponFromText(text);
      }
    }

    if (out.length < max) out.push(offer);
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
  if (isWeakTitle(t)) {
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

  // Links-only do Firecrawl chegam sem preço; re-varre HTML (MeLi ~87% null em prod).
  return enrichMissingPrices([...byUrl.values()], html, baseUrl).slice(0, max);
}
