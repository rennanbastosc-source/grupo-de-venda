import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Provider correto para a fonte da oferta. Fonte única desta regra: o pipeline
 * emite o link por aqui e o guard do disparo valida por aqui — antes viviam
 * separados e uma oferta ML enfileirava com link legado do generic-tag.
 */
export function providerSlugForSource(source: string): string {
  return source === "mercadolivre" ? "mercadolivre" : "generic-tag";
}

/** Resolve o id do provider da fonte; `defaultProviderId` cobre slug ausente. */
export async function resolveProviderId(
  supabase: SupabaseClient,
  source: string,
  defaultProviderId: string | null,
): Promise<string | null> {
  const { data } = await supabase
    .from("affiliate_providers")
    .select("id")
    .eq("slug", providerSlugForSource(source))
    .maybeSingle();
  return data?.id ?? defaultProviderId;
}
