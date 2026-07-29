import type { EmitResult, ProviderConfig } from "../types";

/** Template `{{url}}` + query params. Secrets only via env if ever needed. */
export function emitGeneric(
  originalUrl: string,
  config: ProviderConfig,
): EmitResult {
  try {
    const template = config.template ?? "{{url}}";
    const filled = template.replaceAll("{{url}}", originalUrl);
    const u = new URL(filled);
    for (const [k, v] of Object.entries(config.params ?? {})) {
      u.searchParams.set(k, v);
    }
    return { ok: true, affiliateUrl: u.toString() };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "URL inválida",
    };
  }
}
