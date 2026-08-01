import type { EmitResult, ProviderConfig } from "../types";
import { emitGeneric } from "./generic";

const PORTAL_PAGE = "https://www.mercadolivre.com.br/afiliados/linkbuilder";
const CREATE_LINK_URL =
  "https://www.mercadolivre.com.br/affiliate-program/api/v2/affiliates/createLink";
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

/**
 * Mercado Livre Afiliado — modo curto (meli.la/XXXX) via endpoint interno do
 * portal, ou modo público (link longo com matt_word/matt_tool) sem sessão.
 *
 * Fluxo validado ao vivo (2026-08-01, HTTP 200):
 * 1. GET na página linkbuilder com a sessão → o Set-Cookie traz um `_csrf`
 *    fresco e o HTML traz `<meta name="csrf-token" content="..."/>`.
 * 2. POST createLink com cookie = sessão + `_csrf` novo e header
 *    `x-csrf-token` = valor do meta. Sem isso o ML responde 403 EBADCSRFTOKEN.
 * Resposta: `{ status, urls: [{ short_url }] }` → `urls[0].short_url`.
 *
 * Secrets server-only: ML_AFFILIATE_COOKIE / ML_AFFILIATE_TAG / ML_AFFILIATE_TOOL.
 */
export async function emitMercadoLivre(
  originalUrl: string,
  config: ProviderConfig,
): Promise<EmitResult> {
  const cookie = process.env.ML_AFFILIATE_COOKIE;
  const tag = process.env.ML_AFFILIATE_TAG ?? config.params?.matt_word;
  const tool = process.env.ML_AFFILIATE_TOOL ?? config.params?.matt_tool;

  // Modo curto: sessão do portal + etiqueta. Sem cookie ou sem tag, não dá para
  // chamar o createLink (body exige tag) → cai no modo longo (degradação graciosa).
  if (cookie && tag) {
    try {
      // Passo 1: GET na página do portal → `_csrf` fresco (Set-Cookie) + meta csrf-token.
      const page = await fetch(PORTAL_PAGE, {
        headers: { "user-agent": UA, cookie },
        signal: AbortSignal.timeout(15_000),
      });
      const pageHtml = await page.text();
      const freshCsrf = /_csrf=([^;]+)/.exec(
        page.headers.get("set-cookie") ?? "",
      )?.[1];
      const metaToken = /<meta name="csrf-token" content="([^"]+)"/i.exec(
        pageHtml,
      )?.[1];
      if (!freshCsrf || !metaToken) {
        return {
          ok: false,
          error:
            "Mercado Livre: falha ao obter CSRF do portal — sessão expirada? (sem _csrf/meta csrf-token)",
        };
      }

      // Passo 2: POST createLink com cookie (sessão + _csrf) e x-csrf-token do meta.
      const res = await fetch(CREATE_LINK_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/plain, */*",
          "x-csrf-token": metaToken,
          referer: PORTAL_PAGE,
          "user-agent": UA,
          cookie: `${cookie}; _csrf=${freshCsrf}`,
        },
        body: JSON.stringify({ urls: [originalUrl], tag }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        return {
          ok: false,
          error: `Mercado Livre: createLink falhou (HTTP ${res.status}) — sessão do portal expirada?`,
        };
      }
      const json: unknown = await res.json();
      const shortUrl = (
        json as { urls?: Array<{ short_url?: string }> }
      )?.urls?.[0]?.short_url;
      if (!shortUrl) {
        return {
          ok: false,
          error:
            "Mercado Livre: createLink respondeu sem short_url — shape inesperado",
        };
      }
      return { ok: true, affiliateUrl: shortUrl };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        error: `Mercado Livre: createLink falhou — sessão do portal expirada? ${msg}`,
      };
    }
  }

  // Modo público: nunca lança por env faltante; sem fetch externo.
  return emitGeneric(originalUrl, {
    template: config.template ?? "{{url}}",
    params: {
      ...config.params,
      ...(tag ? { matt_word: tag } : {}),
      ...(tool ? { matt_tool: tool } : {}),
    },
  });
}
