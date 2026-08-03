import type { SupabaseClient } from "@supabase/supabase-js";
import { generateCaption } from "@/lib/ai/caption";
import { emitAffiliateLink } from "@/lib/affiliates/emit";
import { enqueueDispatch } from "@/lib/dispatch/enqueue";
import { formatPriceCents } from "@/lib/dispatch/template";
import { isSheetsConfigured, overwriteRows } from "@/lib/sheets/client";
import type { PipelineResult } from "./types";

/** Espelho somente-leitura: id | link | caption | status */
const MIRROR_HEADER = ["id", "link", "caption", "status"] as const;
const MIRROR_LIMIT = 500;

// Teto duro por run: protege o 9router (30s/caption, sequencial).
const MAX_BATCH = 25;

type PipelineSettings = {
  /** Batch das fases caption/afiliado/enqueue, derivado de daily_offer_cap. */
  batch: number;
  defaultProviderId: string | null;
  autoDispatchEnabled: boolean;
  autoGroupIds: string[];
};

/** Leitura única de app_settings por run — as fases recebem por parâmetro. */
async function loadPipelineSettings(
  supabase: SupabaseClient,
): Promise<PipelineSettings> {
  const { data } = await supabase
    .from("app_settings")
    .select(
      "daily_offer_cap, default_affiliate_provider_id, auto_dispatch_enabled, auto_dispatch_group_ids",
    )
    .eq("id", 1)
    .maybeSingle();
  const cap = data?.daily_offer_cap ?? 10;
  return {
    batch: Math.min(Math.max(cap, 1), MAX_BATCH),
    defaultProviderId:
      (data?.default_affiliate_provider_id as string | null) ?? null,
    autoDispatchEnabled: Boolean(data?.auto_dispatch_enabled),
    autoGroupIds: (data?.auto_dispatch_group_ids ?? []) as string[],
  };
}

type OfferRow = {
  id: string;
  title: string;
  price_cents: number | null;
  url: string;
  source: string;
  status: string;
  caption: string | null;
  caption_status: string;
  updated_at: string;
};

/** Gera legendas via 9router para caption_status pending|none|failed (repescagem). */
async function generateCaptions(
  supabase: SupabaseClient,
  result: PipelineResult,
  batch: number,
): Promise<void> {
  const { data: offers, error } = await supabase
    .from("offers")
    .select(
      "id, title, price_cents, url, source, status, caption, caption_status, updated_at",
    )
    // ponytail: failed reentra todo run (erro 401/429 é transitório); se um dia
    // uma oferta "envenenada" monopolizar o batch, adicionar contador de tentativas
    .in("caption_status", ["pending", "none", "failed"])
    .in("status", ["new", "approved"])
    .order("scraped_at", { ascending: true })
    .limit(batch);

  if (error) {
    result.errors.push(`caption: ${error.message}`);
    return;
  }
  if (!offers?.length) return;

  for (const o of offers as OfferRow[]) {
    try {
      const caption = await generateCaption({
        title: o.title,
        price: formatPriceCents(o.price_cents),
        url: o.url,
      });
      const now = new Date().toISOString();
      const { error: uerr } = await supabase
        .from("offers")
        .update({
          caption,
          caption_status: "ready",
          updated_at: now,
        })
        .eq("id", o.id);
      if (uerr) {
        result.errors.push(`caption db ${o.id}: ${uerr.message}`);
        continue;
      }
      result.captioned += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      result.errors.push(`caption ${o.id}: ${msg}`);
      await supabase
        .from("offers")
        .update({
          caption_status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", o.id);
    }
  }
}

/** Emite afiliado default se faltar link ok. */
async function ensureAffiliates(
  supabase: SupabaseClient,
  result: PipelineResult,
  cfg: PipelineSettings,
): Promise<void> {
  const defaultProviderId = cfg.defaultProviderId;
  if (!defaultProviderId) return;

  // Roteia provider por source: mercadolivre → provider ML; demais
  // marketplaces → generic-tag (createLink do ML rejeita URL de outro site).
  const { data: providers } = await supabase
    .from("affiliate_providers")
    .select("id, slug");
  const providerBySlug = new Map(
    (providers ?? []).map((p) => [p.slug as string, p.id as string]),
  );

  // Exclui ofertas com link failed recente (head-of-line): oferta antiga com
  // failed re-tentada a cada run engole o batch e bloqueia ofertas novas.
  // Failed de <1h sai da fila; re-tenta depois de 1h.
  const { data: recentFails } = await supabase
    .from("affiliate_links")
    .select("offer_id")
    .eq("status", "failed")
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  const failedOfferIds = [
    ...new Set(
      (recentFails ?? []).map((r) => r.offer_id).filter(Boolean),
    ),
  ];

  let q = supabase
    .from("offers")
    .select("id, source")
    .eq("caption_status", "ready")
    .in("status", ["new", "approved"])
    .order("scraped_at", { ascending: true })
    .limit(cfg.batch);
  if (failedOfferIds.length) q = q.not("id", "in", failedOfferIds);
  const { data: offers, error } = await q;

  if (error) {
    result.errors.push(`affiliate: ${error.message}`);
    return;
  }
  if (!offers?.length) return;

  for (const o of offers) {
    // mercadolivre → provider ML (link curto meli.la); demais sources →
    // generic-tag. Fallback para o default se o slug não existir.
    const providerId =
      o.source === "mercadolivre"
        ? (providerBySlug.get("mercadolivre") ?? defaultProviderId)
        : (providerBySlug.get("generic-tag") ?? defaultProviderId);

    // Skip só se já existe link ok DO provider que seria usado — link ok de
    // outro provider (ex: generic-tag em oferta ML pré-meli.la) não bloqueia
    // regeneração. Evita oferta ML presa em URL longa pra sempre.
    const { data: link } = await supabase
      .from("affiliate_links")
      .select("id")
      .eq("offer_id", o.id)
      .eq("status", "ok")
      .eq("provider_id", providerId)
      .limit(1)
      .maybeSingle();
    if (link) continue;

    const emitted = await emitAffiliateLink(supabase, {
      offerId: o.id,
      providerId,
    });
    if (!emitted.ok) {
      result.errors.push(`affiliate ${o.id}: ${emitted.error}`);
      continue;
    }
    if (emitted.link.status === "ok") result.affiliates += 1;
    else result.errors.push(`affiliate ${o.id}: ${emitted.link.error}`);
  }
}

/** Auto-enqueue se flag + grupos + caption ready + affiliate. */
async function autoEnqueue(
  supabase: SupabaseClient,
  result: PipelineResult,
  cfg: PipelineSettings,
): Promise<void> {
  if (!cfg.autoDispatchEnabled) return;
  const groupIds = cfg.autoGroupIds;
  if (!groupIds.length) return;

  const { data: offers, error } = await supabase
    .from("offers")
    .select("id")
    .eq("caption_status", "ready")
    .in("status", ["new", "approved"])
    .order("scraped_at", { ascending: true })
    .limit(cfg.batch);

  if (error) {
    result.errors.push(`enqueue: ${error.message}`);
    return;
  }
  if (!offers?.length) return;

  for (const o of offers) {
    const r = await enqueueDispatch(supabase, {
      offerId: o.id,
      groupIds,
    });
    if (!r.ok) {
      // skip silencioso se sem afiliado / já hoje / WA off — só loga
      result.errors.push(`enqueue ${o.id}: ${r.error}`);
      continue;
    }
    result.enqueued += r.result.created.length;
    if (r.result.created.length > 0) {
      await supabase
        .from("offers")
        .update({
          status: "approved",
          updated_at: new Date().toISOString(),
        })
        .eq("id", o.id)
        .in("status", ["new"]);
    }
  }
}

/**
 * Espelho somente-leitura: reescreve a aba inteira (header + ofertas com
 * caption pronta ou já enviadas). Mão única — nada volta da planilha.
 */
export async function mirrorToSheets(
  supabase: SupabaseClient,
  result: PipelineResult,
): Promise<void> {
  if (!isSheetsConfigured()) return;

  const { data: offers, error } = await supabase
    .from("offers")
    .select("id, status, caption, caption_status")
    .or("caption_status.eq.ready,status.eq.sent")
    .order("scraped_at", { ascending: false })
    .limit(MIRROR_LIMIT);

  if (error) {
    result.errors.push(`mirror: ${error.message}`);
    return;
  }
  if (!offers?.length) return;

  const { data: links } = await supabase
    .from("affiliate_links")
    .select("offer_id, affiliate_url")
    .in(
      "offer_id",
      offers.map((o) => o.id),
    )
    .eq("status", "ok")
    .order("created_at", { ascending: false });
  const linkByOffer = new Map<string, string>();
  for (const l of links ?? []) {
    if (!linkByOffer.has(l.offer_id as string)) {
      linkByOffer.set(l.offer_id as string, l.affiliate_url as string);
    }
  }

  const rows: string[][] = [[...MIRROR_HEADER]];
  for (const o of offers) {
    rows.push([
      o.id as string,
      linkByOffer.get(o.id as string) ?? "",
      (o.caption as string | null) ?? "",
      o.status === "sent" ? "enviado" : "pendente",
    ]);
  }

  try {
    await overwriteRows(rows);
    result.mirrored = rows.length - 1;
  } catch (e) {
    result.errors.push(
      `mirror: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

/**
 * Orquestra: captions → affiliate → auto-enqueue → espelho Sheets.
 * DB canônico; a planilha é espelho read-only (reescrita completa).
 */
export async function runOfferPipeline(
  supabase: SupabaseClient,
): Promise<PipelineResult> {
  const result: PipelineResult = {
    captioned: 0,
    affiliates: 0,
    enqueued: 0,
    mirrored: 0,
    errors: [],
  };

  const cfg = await loadPipelineSettings(supabase);

  await generateCaptions(supabase, result, cfg.batch);
  await ensureAffiliates(supabase, result, cfg);
  await autoEnqueue(supabase, result, cfg);
  await mirrorToSheets(supabase, result);

  return result;
}
