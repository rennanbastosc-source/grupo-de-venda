import type { EmitResult, ProviderConfig } from "../types";
import { emitGeneric } from "./generic";

/** ponytail: template only until LIVELO API docs; upgrade when credentials exist */
export function emitLivelo(
  originalUrl: string,
  config: ProviderConfig,
): EmitResult {
  const tag = process.env.LIVELO_TAG;
  const merged: ProviderConfig = {
    template: config.template ?? "{{url}}",
    params: {
      utm_source: "livelo",
      ...(tag ? { tag } : {}),
      ...config.params,
    },
  };
  return emitGeneric(originalUrl, merged);
}
