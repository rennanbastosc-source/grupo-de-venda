import type { AffiliateProvider, EmitResult } from "./types";
import { emitGeneric } from "./providers/generic";
import { emitLivelo } from "./providers/livelo";
import { emitMeliuz } from "./providers/meliuz";

export function emitWithProvider(
  provider: Pick<AffiliateProvider, "kind" | "config" | "active">,
  originalUrl: string,
): EmitResult {
  if (!provider.active) {
    return { ok: false, error: "Provider inativo" };
  }
  switch (provider.kind) {
    case "livelo":
      return emitLivelo(originalUrl, provider.config ?? {});
    case "meliuz":
      return emitMeliuz(originalUrl, provider.config ?? {});
    case "generic":
      return emitGeneric(originalUrl, provider.config ?? {});
    default:
      return { ok: false, error: `Kind desconhecido: ${provider.kind}` };
  }
}
