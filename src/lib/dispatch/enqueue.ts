import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertGroupActive,
  assertOfferReady,
  assertSessionConnected,
  hasDispatchToday,
} from "./guards";
import { buildMessage, formatPriceCents } from "./template";

export type EnqueueResult = {
  created: { id: string; groupId: string }[];
  skipped: { groupId: string; reason: string }[];
};

export async function enqueueDispatch(
  supabase: SupabaseClient,
  input: { offerId: string; groupIds: string[] },
): Promise<
  | { ok: true; result: EnqueueResult }
  | { ok: false; status: number; error: string }
> {
  if (!input.offerId || !input.groupIds?.length) {
    return {
      ok: false,
      status: 400,
      error: "offerId e groupIds obrigatórios",
    };
  }

  const session = await assertSessionConnected();
  if (!session.ok) {
    return { ok: false, status: session.status, error: session.error };
  }

  const offer = await assertOfferReady(supabase, input.offerId);
  if (!offer.ok) return { ok: false, status: offer.status, error: offer.error };

  const { data: settings, error: serr } = await supabase
    .from("app_settings")
    .select("message_template")
    .eq("id", 1)
    .maybeSingle();
  if (serr) return { ok: false, status: 500, error: serr.message };

  const template =
    settings?.message_template ??
    "🔥 {{title}}\n💰 {{price}}\n🔗 {{affiliate_url}}";
  const message_body = buildMessage(template, {
    title: offer.title,
    price: formatPriceCents(offer.price_cents),
    affiliate_url: offer.affiliate_url,
  });

  const created: EnqueueResult["created"] = [];
  const skipped: EnqueueResult["skipped"] = [];

  for (const groupId of input.groupIds) {
    const g = await assertGroupActive(supabase, groupId);
    if (!g.ok) {
      skipped.push({ groupId, reason: g.error });
      continue;
    }
    if (await hasDispatchToday(supabase, input.offerId, groupId)) {
      skipped.push({
        groupId,
        reason: "Já enfileirado/enviado para este grupo hoje",
      });
      continue;
    }

    const { data: job, error } = await supabase
      .from("dispatch_jobs")
      .insert({
        offer_id: input.offerId,
        group_id: groupId,
        affiliate_link_id: offer.affiliate_link_id,
        status: "queued",
        message_body,
      })
      .select("id")
      .single();

    if (error || !job) {
      skipped.push({ groupId, reason: error?.message ?? "insert fail" });
      continue;
    }
    created.push({ id: job.id, groupId });
  }

  if (created.length === 0 && skipped.length > 0) {
    return {
      ok: false,
      status: 400,
      error: skipped.map((s) => s.reason).join("; "),
    };
  }

  return { ok: true, result: { created, skipped } };
}
