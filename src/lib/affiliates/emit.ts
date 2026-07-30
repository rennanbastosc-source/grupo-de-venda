import type { SupabaseClient } from "@supabase/supabase-js";
import { emitWithProvider } from "./registry";
import type { AffiliateProvider, ProviderConfig, ProviderKind } from "./types";

export type EmitInput = {
  offerId?: string;
  url?: string;
  providerId: string;
};

export type EmitLinkRow = {
  id: string;
  affiliate_url: string;
  status: "ok" | "failed";
  error: string | null;
};

function asProvider(row: {
  id: string;
  slug: string;
  name: string;
  kind: string;
  config: unknown;
  active: boolean;
}): AffiliateProvider {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    kind: row.kind as ProviderKind,
    config: (row.config ?? {}) as ProviderConfig,
    active: row.active,
  };
}

export async function emitAffiliateLink(
  supabase: SupabaseClient,
  input: EmitInput,
): Promise<
  | { ok: true; link: EmitLinkRow }
  | { ok: false; status: number; error: string }
> {
  if (!input.providerId) {
    return { ok: false, status: 400, error: "providerId obrigatório" };
  }

  let originalUrl = typeof input.url === "string" ? input.url.trim() : "";
  const offerId: string | null =
    typeof input.offerId === "string" ? input.offerId : null;

  if (offerId) {
    const { data: offer, error } = await supabase
      .from("offers")
      .select("id, url")
      .eq("id", offerId)
      .maybeSingle();
    if (error) return { ok: false, status: 500, error: error.message };
    if (!offer) return { ok: false, status: 404, error: "Oferta não encontrada" };
    if (!originalUrl) originalUrl = offer.url;
  }

  if (!originalUrl) {
    return { ok: false, status: 400, error: "url ou offerId obrigatório" };
  }

  const { data: prow, error: perr } = await supabase
    .from("affiliate_providers")
    .select("*")
    .eq("id", input.providerId)
    .maybeSingle();
  if (perr) return { ok: false, status: 500, error: perr.message };
  if (!prow) {
    return { ok: false, status: 404, error: "Provider não encontrado" };
  }

  const provider = asProvider(prow);
  const result = emitWithProvider(provider, originalUrl);

  if (!result.ok) {
    const { data: failed, error: ferr } = await supabase
      .from("affiliate_links")
      .insert({
        offer_id: offerId,
        provider_id: provider.id,
        original_url: originalUrl,
        affiliate_url: originalUrl,
        status: "failed",
        error: result.error,
      })
      .select("id, affiliate_url, status, error")
      .single();
    if (ferr) return { ok: false, status: 500, error: ferr.message };
    return {
      ok: true,
      link: failed as EmitLinkRow,
    };
  }

  const { data: link, error: lerr } = await supabase
    .from("affiliate_links")
    .insert({
      offer_id: offerId,
      provider_id: provider.id,
      original_url: originalUrl,
      affiliate_url: result.affiliateUrl,
      status: "ok",
      error: null,
    })
    .select("id, affiliate_url, status, error")
    .single();
  if (lerr) return { ok: false, status: 500, error: lerr.message };
  return { ok: true, link: link as EmitLinkRow };
}
