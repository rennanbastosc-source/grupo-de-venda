import type { SupabaseClient } from "@supabase/supabase-js";

/** Gate Fatia 05: disparo exige affiliate_links ok para a oferta. */
export async function assertOfferHasAffiliateLink(
  supabase: SupabaseClient,
  offerId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("affiliate_links")
    .select("id")
    .eq("offer_id", offerId)
    .eq("status", "ok")
    .limit(1)
    .maybeSingle();
  if (error) return false;
  return !!data;
}
