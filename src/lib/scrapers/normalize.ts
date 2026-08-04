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
  "th",
  "keywords",
  "qid",
  "sr",
  "sprefix",
  "crid",
  // Tracking ML/Shopee de listagem e oferta (matt_* fica: é o link de afiliado)
  "deal_print_id",
  "lm",
  "page",
  "pdp_filters",
  "polycard_client",
  "position",
  "search_layout",
  "searchvariation",
  "sid",
  "tracking_id",
  "wid",
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

/** Token BRL → centavos. Aceita: 1.499,00 | 1.499 00 | 698,00 | 698 00 | 698 | 1.499 */
function brlTokenToCents(token: string): number | undefined {
  const t = token.trim().replace(/\s+/g, " ");
  if (!t) return undefined;

  // Centavos separados por espaço (artefato de strip de tags: "1.499 00")
  const spaceCents = /^(\d{1,3}(?:\.\d{3})+|\d+)\s+(\d{2})$/.exec(t);
  if (spaceCents) {
    const whole = Number(spaceCents[1].replace(/\./g, ""));
    const cents = Number(spaceCents[2]);
    if (!Number.isFinite(whole) || !Number.isFinite(cents) || whole <= 0) return undefined;
    return whole * 100 + cents;
  }

  // Formato clássico com vírgula: 1.499,00 / 698,00
  if (t.includes(",")) {
    const [intPart, decPart = ""] = t.split(",");
    const whole = Number(intPart.replace(/\./g, ""));
    const cents = Number((decPart + "00").slice(0, 2));
    if (!Number.isFinite(whole) || !Number.isFinite(cents) || whole < 0) return undefined;
    if (whole === 0 && cents === 0) return undefined;
    return whole * 100 + cents;
  }

  // Inteiro em reais (com ou sem milhar): 1.499 → 149900; 698 → 69800
  if (!/^\d{1,3}(?:\.\d{3})+$|^\d+$/.test(t)) return undefined;
  const whole = Number(t.replace(/\./g, ""));
  if (!Number.isFinite(whole) || whole <= 0) return undefined;
  return whole * 100;
}

// Grupo capturável de valor BRL (milhar opcional + centavos ,|espaço opcionais)
const BRL_NUM =
  String.raw`\d{1,3}(?:\.\d{3})+(?:\s*\d{2}(?!\d)|\s*,\s*\d{2})?|\d+(?:\s*\d{2}(?!\d)|\s*,\s*\d{2})?`;

export function parsePricesFromText(text: string): {
  priceCents?: number;
  originalPriceCents?: number;
} {
  if (!text) return {};

  let cleanText = text;

  // Parcelamento (ex: "10x de R$ 100", "12x R$ 50,00")
  cleanText = cleanText.replace(
    new RegExp(String.raw`\b\d{1,2}\s*x\s*(?:de\s*)?(?:R\$\s*)?(?:${BRL_NUM})`, "gi"),
    " ",
  );

  // Pix / cashback / cupom — não são preço de vitrine (costumam vir depois)
  // 1) keyword → valor  ("no Pix R$ 650", "cashback R$ 50")
  cleanText = cleanText.replace(
    new RegExp(
      String.raw`(?:(?:no\s+)?pix|cashback|cupom)\s*(?::\s*|de\s*)?(?:R\$\s*)?(?:${BRL_NUM})`,
      "gi",
    ),
    " ",
  );
  // 2) valor → keyword, só se não houver outro R$ logo após ("R$ 650 no Pix")
  cleanText = cleanText.replace(
    new RegExp(
      String.raw`(?:R\$\s*)?(?:${BRL_NUM})\s*(?:no\s+)?pix\b(?!\s*R\$)`,
      "gi",
    ),
    " ",
  );
  cleanText = cleanText.replace(
    new RegExp(
      String.raw`(?:R\$\s*)?(?:${BRL_NUM})\s*(?:cashback|cupom)\b`,
      "gi",
    ),
    " ",
  );

  // "de R$ X por R$ Y"
  const dePorRe = new RegExp(
    String.raw`(?:de\s+(?:R\$\s*)?|de\s+R\$\s*)(${BRL_NUM})\s*(?:por\s+(?:R\$\s*)?|por\s+R\$\s*)(${BRL_NUM})`,
    "i",
  );
  const dePorMatch = dePorRe.exec(cleanText);
  if (dePorMatch) {
    const orig = brlTokenToCents(dePorMatch[1]);
    const curr = brlTokenToCents(dePorMatch[2]);
    if (orig != null && curr != null && orig > curr && curr > 0) {
      return { priceCents: curr, originalPriceCents: orig };
    }
  }

  // Com R$: inteiro ou com centavos. Sem R$: só com vírgula (evita IDs soltos).
  const priceRegex = new RegExp(
    String.raw`R\$\s*(${BRL_NUM})|(\d{1,3}(?:\.\d{3})*,\s*\d{2}|\d+,\s*\d{2})`,
    "gi",
  );
  const matches: number[] = [];
  let m: RegExpExecArray | null;

  while ((m = priceRegex.exec(cleanText)) !== null) {
    const raw = (m[1] ?? m[2] ?? "").replace(/\s+/g, " ").trim();
    const cents = brlTokenToCents(raw);
    if (cents != null && cents > 0) matches.push(cents);
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

const COUPON_STOPWORDS = new Set([
  "AQUI",
  "NAO",
  "NÃO",
  "MAIS",
  "PARA",
  "COM",
  "SEM",
  "DESCONTO",
  "VALIDO",
  "VÁLIDO",
  "APLICADO",
  "DISPONIVEL",
  "DISPONÍVEL",
  "FISCAL",
  "MANUAL",
  "SITE",
  "LOJA",
  "ABAIXO",
]);

export function parseCouponFromText(text: string): string | undefined {
  if (!text) return undefined;
  const re =
    /(?:cupom|código|codigo)(?:\s+de\s+desconto)?\s*:\s*([A-Z0-9-]{3,24})|(?:cupom|código|codigo)(?:\s+de\s+desconto)?\s+([A-Z0-9-]{3,24})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = (m[1] ?? m[2] ?? "").trim();
    if (!raw) continue;
    const code = raw.toUpperCase();
    if (
      code.length >= 3 &&
      code.length <= 24 &&
      !/^\d+$/.test(code) &&
      !COUPON_STOPWORDS.has(code)
    ) {
      return code;
    }
  }
  return undefined;
}
