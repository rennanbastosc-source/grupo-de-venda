const TRACKING = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "ref",
  "ref_",
  "tag",
  "pf_rd_r",
  "pf_rd_p",
  "psc",
  "smid",
  "sp_csd",
  "dib",
  "dib_tag",
  "matt_tool",
  "matt_word",
  "th",
  "keywords",
  "qid",
  "sr",
  "sprefix",
  "crid",
]);

export function canonicalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    throw new Error(`URL inválida: ${raw}`);
  }
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  if (u.hostname.startsWith("www.")) {
    u.hostname = u.hostname.slice(4);
  }
  const kept = [...u.searchParams.entries()]
    .filter(([k]) => !TRACKING.has(k.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b));
  u.search = "";
  for (const [k, v] of kept) u.searchParams.append(k, v);

  let path = u.pathname.replace(/\/+$/, "") || "/";
  // Amazon /dp/ASIN
  const dp = path.match(/\/dp\/([A-Z0-9]{10})/i);
  if (dp && u.hostname.includes("amazon.")) {
    path = `/dp/${dp[1].toUpperCase()}`;
    u.search = "";
  }
  u.pathname = path;
  u.protocol = "https:";
  return u.toString();
}

export function parsePricesFromText(text: string): {
  priceCents?: number;
  originalPriceCents?: number;
} {
  if (!text) return {};

  // Remove parcelamento (ex: "10x de R$ 100", "12x R$ 50") para não poluir valores
  const cleanText = text.replace(/\b\d{1,2}\s*x\s*(?:de\s*)?(?:R\$\s*)?\d+(?:[.,]\d+)?/gi, "");

  // Procurar por padrão "de R$ X por R$ Y" ou "R$ X R$ Y"
  const dePorMatch = /(?:de|de\s+R\$)\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\s*(?:por|por\s+R\$)\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/i.exec(cleanText);
  if (dePorMatch) {
    const orig = Math.round(Number(dePorMatch[1].replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".")) * 100);
    const curr = Math.round(Number(dePorMatch[2].replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".")) * 100);
    if (orig > curr && curr > 0) {
      return { priceCents: curr, originalPriceCents: orig };
    }
  }

  // Match valores no formato R$ X.XXX,XX ou R$ X,XX ou X,XX
  const priceRegex = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/gi;
  const matches: number[] = [];
  let m: RegExpExecArray | null;

  while ((m = priceRegex.exec(cleanText)) !== null) {
    const rawVal = m[1].replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
    const val = Number(rawVal);
    if (Number.isFinite(val) && val > 0) {
      matches.push(Math.round(val * 100));
    }
  }

  if (matches.length === 0) return {};

  if (matches.length >= 2) {
    const [first, second] = matches;
    if (first > second) {
      return { priceCents: second, originalPriceCents: first };
    }
  }

  return { priceCents: matches[0] };
}

export function parsePriceToCents(text: string): number | undefined {
  return parsePricesFromText(text).priceCents;
}
