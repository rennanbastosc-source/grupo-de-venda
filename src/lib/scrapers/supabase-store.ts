import type { SupabaseClient } from "@supabase/supabase-js";
import type { OfferStore } from "./run-pipeline";
import type { NormalizedOffer, ScrapeSource } from "./types";

export function createSupabaseOfferStore(
  supabase: SupabaseClient,
): OfferStore {
  return {
    async startRun(source: ScrapeSource) {
      const { data, error } = await supabase
        .from("scrape_runs")
        .insert({ source })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data.id as string;
    },
    async finishRun(id, result) {
      await supabase
        .from("scrape_runs")
        .update({
          finished_at: new Date().toISOString(),
          ok: result.ok,
          items_found: result.itemsFound,
          items_upserted: result.itemsUpserted,
          error: result.error ?? null,
        })
        .eq("id", id);
    },
    async upsertOffer(offer: NormalizedOffer) {
      const row = {
        source: offer.source,
        external_id: offer.externalId ?? null,
        title: offer.title,
        price_cents: offer.priceCents ?? null,
        url: offer.url,
        url_canonical: offer.urlCanonical,
        image_url: offer.imageUrl ?? null,
        updated_at: new Date().toISOString(),
      };
      const { data: existing } = await supabase
        .from("offers")
        .select("id, status")
        .eq("source", offer.source)
        .eq("url_canonical", offer.urlCanonical)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("offers")
          .update({
            ...row,
            // keep status if already approved/sent/rejected
          })
          .eq("id", existing.id);
        return "updated";
      }
      const { error } = await supabase.from("offers").insert({
        ...row,
        status: "new",
      });
      if (error) {
        if (error.code === "23505") return "skipped";
        throw new Error(error.message);
      }
      return "inserted";
    },
  };
}
