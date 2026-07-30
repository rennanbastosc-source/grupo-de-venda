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

export function parsePriceToCents(text: string): number | undefined {
  const cleaned = text
    .replace(/[^\d,.]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(n * 100);
}
