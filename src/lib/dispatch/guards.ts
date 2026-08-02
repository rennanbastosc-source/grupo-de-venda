import type { SupabaseClient } from "@supabase/supabase-js";
import { assertOfferHasAffiliateLink } from "@/lib/affiliates/require-link";
import { getWorkerSession } from "@/lib/worker-client";
import { dayStartInTz } from "./rate-limit";

export type GuardFail = { ok: false; error: string; status: number };
export type GuardOk = { ok: true };

export async function assertSessionConnected(): Promise<
  GuardOk | GuardFail
> {
  const session = await getWorkerSession();
  if (!session.ok) {
    return {
      ok: false,
      error: session.error || "Sessão WhatsApp indisponível",
      status: 503,
    };
  }
  if (session.data.status !== "connected") {
    return {
      ok: false,
      error:
        "WhatsApp desconectado — reconecte em /dashboard/bot",
      status: 409,
    };
  }
  return { ok: true };
}

export async function assertGroupActive(
  supabase: SupabaseClient,
  groupId: string,
): Promise<GuardOk | GuardFail | { ok: true; jid: string; name: string }> {
  const { data, error } = await supabase
    .from("wa_groups")
    .select("id, jid, name, active")
    .eq("id", groupId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message, status: 500 };
  if (!data) return { ok: false, error: "Grupo não encontrado", status: 404 };
  if (!data.active) {
    return { ok: false, error: "Grupo inativo", status: 400 };
  }
  return { ok: true, jid: data.jid, name: data.name };
}

export async function assertOfferReady(
  supabase: SupabaseClient,
  offerId: string,
): Promise<
  | GuardFail
  | {
      ok: true;
      title: string;
      price_cents: number | null;
      affiliate_link_id: string;
      affiliate_url: string;
      caption: string | null;
    }
> {
  const { data: offer, error } = await supabase
    .from("offers")
    .select("id, title, price_cents, status, caption")
    .eq("id", offerId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message, status: 500 };
  if (!offer) return { ok: false, error: "Oferta não encontrada", status: 404 };

  const hasLink = await assertOfferHasAffiliateLink(supabase, offerId);
  if (!hasLink) {
    return {
      ok: false,
      error: "Oferta sem link afiliado válido",
      status: 400,
    };
  }

  const { data: link, error: lerr } = await supabase
    .from("affiliate_links")
    .select("id, affiliate_url")
    .eq("offer_id", offerId)
    .eq("status", "ok")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lerr) return { ok: false, error: lerr.message, status: 500 };
  if (!link) {
    return {
      ok: false,
      error: "Oferta sem link afiliado válido",
      status: 400,
    };
  }

  return {
    ok: true,
    title: offer.title,
    price_cents: offer.price_cents,
    affiliate_link_id: link.id,
    affiliate_url: link.affiliate_url,
    caption: offer.caption ?? null,
  };
}

/** Já existe job sent/queued/sending para offer+group no dia atual (DISPATCH_TZ)? */
export async function hasDispatchToday(
  supabase: SupabaseClient,
  offerId: string,
  groupId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const dayStart = dayStartInTz(now);
  const { data, error } = await supabase
    .from("dispatch_jobs")
    .select("id, status, sent_at, created_at")
    .eq("offer_id", offerId)
    .eq("group_id", groupId)
    .in("status", ["queued", "sending", "sent"])
    .gte("created_at", dayStart.toISOString())
    .limit(1);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}
