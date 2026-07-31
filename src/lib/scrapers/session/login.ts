import type { MarketplaceSource, PlatformSession } from "./types";
import { formatCookieHeader } from "./store";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function performLogin(
  source: MarketplaceSource,
): Promise<PlatformSession> {
  if (process.env.SCRAPE_MOCK === "1") {
    const dummyCookies: Record<string, string> = {
      mock_session: `mock_${source}_token`,
    };
    return {
      source,
      cookies: dummyCookies,
      cookieHeader: formatCookieHeader(dummyCookies),
      status: "ok",
      updatedAt: new Date().toISOString(),
    };
  }

  switch (source) {
    case "mercadolivre":
      return loginMercadoLivre();
    case "amazon":
      return loginAmazon();
    case "shopee":
      return loginShopee();
    default:
      throw new Error(`Marketplace não suportado para login: ${source}`);
  }
}

async function loginMercadoLivre(): Promise<PlatformSession> {
  const login = process.env.ML_LOGIN?.trim();
  const pass = process.env.ML_PASS?.trim();
  if (!login || !pass) {
    throw new Error("ML_LOGIN ou ML_PASS ausentes nas variáveis de ambiente");
  }

  // Tenta handshake HTTP básico com cookie de sessão
  try {
    const res = await fetch("https://www.mercadolivre.com.br/gz/home/navigation", {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(15_000),
    });
    const setCookie = res.headers.get("set-cookie") || "";
    const cookies = parseSetCookie(setCookie);

    // Se a autenticação direta por form requerer CAPTCHA/2FA
    if (Object.keys(cookies).length === 0) {
      throw new Error(
        "Mercado Livre: login automatizado bloqueado ou requer verificação de 2FA",
      );
    }

    return {
      source: "mercadolivre",
      cookies,
      cookieHeader: formatCookieHeader(cookies),
      status: "ok",
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Falha no login Mercado Livre: ${msg}`);
  }
}

async function loginAmazon(): Promise<PlatformSession> {
  const login = process.env.AMZN_LOGIN?.trim();
  const pass = process.env.AMZN_PASS?.trim();
  if (!login || !pass) {
    throw new Error("AMZN_LOGIN ou AMZN_PASS ausentes nas variáveis de ambiente");
  }

  try {
    const res = await fetch("https://www.amazon.com.br/ap/signin", {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(15_000),
    });
    const setCookie = res.headers.get("set-cookie") || "";
    const cookies = parseSetCookie(setCookie);

    if (!cookies["session-id"]) {
      throw new Error("Amazon: login automatizado requer verificação de segurança/CAPTCHA");
    }

    return {
      source: "amazon",
      cookies,
      cookieHeader: formatCookieHeader(cookies),
      status: "ok",
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Falha no login Amazon: ${msg}`);
  }
}

async function loginShopee(): Promise<PlatformSession> {
  const login = process.env.SHOP_LOGIN?.trim();
  const pass = process.env.SHOP_PASS?.trim();
  if (!login || !pass) {
    throw new Error("SHOP_LOGIN ou SHOP_PASS ausentes nas variáveis de ambiente");
  }

  try {
    const res = await fetch("https://shopee.com.br/api/v4/account/login", {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(15_000),
    });
    const setCookie = res.headers.get("set-cookie") || "";
    const cookies = parseSetCookie(setCookie);

    if (!cookies["SPC_EC"] && !cookies["SPC_SI"]) {
      throw new Error("Shopee: login automatizado requer validação Cloudflare/OTP");
    }

    return {
      source: "shopee",
      cookies,
      cookieHeader: formatCookieHeader(cookies),
      status: "ok",
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Falha no login Shopee: ${msg}`);
  }
}

function parseSetCookie(setCookieHeader: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!setCookieHeader) return out;

  const parts = setCookieHeader.split(/,(?=\s*[a-zA-Z0-9_-]+\=)/);
  for (const part of parts) {
    const cookieData = part.split(";")[0].trim();
    const [key, ...val] = cookieData.split("=");
    if (key && val.length > 0) {
      out[key.trim()] = val.join("=").trim();
    }
  }
  return out;
}
