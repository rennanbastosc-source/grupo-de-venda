import type { AffiliateProvider, EmitResult } from "./types";
import { emitGeneric } from "./providers/generic";
import { emitMercadoLivre } from "./providers/mercadolivre";

export async function emitWithProvider(
  provider: Pick<AffiliateProvider, "kind" | "config" | "active">,
  originalUrl: string,
): Promise<EmitResult> {
  if (!provider.active) {
    return { ok: false, error: "Provider inativo" };
  }
  const config = provider.config ?? {};
  switch (provider.kind) {
    case "livelo": {
      const tag = process.env.LIVELO_TAG;
      return emitGeneric(originalUrl, {
        template: config.template ?? "{{url}}",
        params: { utm_source: "livelo", ...(tag ? { tag } : {}), ...config.params },
      });
    }
    case "meliuz": {
      const partner = process.env.MELIUZ_PARTNER;
      return emitGeneric(originalUrl, {
        template: config.template ?? "{{url}}",
        params: { utm_source: "meliuz", ...(partner ? { partner } : {}), ...config.params },
      });
    }
    case "generic":
      return emitGeneric(originalUrl, config);
    case "mercadolivre":
      return emitMercadoLivre(originalUrl, config);
    default:
      return { ok: false, error: `Kind desconhecido: ${provider.kind}` };
  }
}
