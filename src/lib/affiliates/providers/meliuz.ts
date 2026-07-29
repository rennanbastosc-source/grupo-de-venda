import type { EmitResult, ProviderConfig } from "../types";
import { emitGeneric } from "./generic";

/** ponytail: template only until MELIUZ API; upgrade when credentials exist */
export function emitMeliuz(
  originalUrl: string,
  config: ProviderConfig,
): EmitResult {
  const partner = process.env.MELIUZ_PARTNER;
  const merged: ProviderConfig = {
    template: config.template ?? "{{url}}",
    params: {
      utm_source: "meliuz",
      ...(partner ? { partner } : {}),
      ...config.params,
    },
  };
  return emitGeneric(originalUrl, merged);
}
