import type { SupabaseClient } from "@supabase/supabase-js";
import { generateCaption } from "@/lib/ai/caption";
import { emitAffiliateLink } from "@/lib/affiliates/emit";
import { enqueueDispatch } from "@/lib/dispatch/enqueue";
import { formatPriceCents } from "@/lib/dispatch/template";
import {
  appendRows,
  isSheetsConfigured,
  readRows,
  updateRows,
} from "@/lib/sheets/client";
import type { PipelineResult } from "./types";

const HEADER = [
  "id",
  "title",
  "price",
  "url",
  "source",
  "status",
  "caption",
  "caption_status",
  "affiliate_url",
  "sheets_synced_at",
  "updated_at",
  "notes",
] as const;

const BATCH = 10;
const CAPTION_BATCH = 3;

type OfferRow = {
  id: string;
  title: string;
  price_cents: number | null;
  url: string;
  source: string;
  status: string;
  caption: string | null;
  caption_status: string;
  sheets_row: number | null;
  updated_at: string;
};

function offerToSheetRow(
  o: OfferRow,
  affiliateUrl: string,
  syncedAt: string,
): string[] {
  return [
    o.id,
    o.title,
    formatPriceCents(o.price_cents),
    o.url,
    o.source,
    o.status,
    o.caption ?? "",
    o.caption_status ?? "none",
    affiliateUrl,
    syncedAt,
    o.updated_at,
    "",
  ];
}

async function affiliateUrlFor(
  supabase: SupabaseClient,
  offerId: string,
): Promise<string> {
  const { data } = await supabase
    .from("affiliate_links")
    .select("affiliate_url")
    .eq("offer_id", offerId)
    .eq("status", "ok")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.affiliate_url ?? "";
}

/** Exporta ofertas novas (sem sheets_row) para a planilha. */
async function exportToSheets(
  supabase: SupabaseClient,
  result: PipelineResult,
): Promise<void> {
  if (!isSheetsConfigured()) return;

  const { data: offers, error } = await supabase
    .from("offers")
    .select(
      "id, title, price_cents, url, source, status, caption, caption_status, sheets_row, updated_at",
    )
    .is("sheets_row", null)
    .in("status", ["new", "approved"])
    .order("scraped_at", { ascending: true })
    .limit(BATCH);

  if (error) {
    result.errors.push(`export: ${error.message}`);
    return;
  }
  if (!offers?.length) return;

  // Garante header se planilha vazia
  try {
    const existing = await readRows();
    if (existing.length === 0) {
      await appendRows([[...HEADER]]);
    }
  } catch (e) {
    result.errors.push(
      `export header: ${e instanceof Error ? e.message : String(e)}`,
    );
    return;
  }

  const rows: string[][] = [];
  const now = new Date().toISOString();
  for (const o of offers as OfferRow[]) {
    const aff = await affiliateUrlFor(supabase, o.id);
    rows.push(offerToSheetRow(o, aff, now));
  }

  try {
    const { startRow } = await appendRows(rows);
    if (startRow == null) {
      result.errors.push("export: append sem startRow");
      return;
    }
    for (let i = 0; i < offers.length; i++) {
      const o = offers[i] as OfferRow;
      const row = startRow + i;
      const { error: uerr } = await supabase
        .from("offers")
        .update({
          sheets_row: row,
          sheets_synced_at: now,
          caption_status:
            o.caption_status === "none" || !o.caption_status
              ? "pending"
              : o.caption_status,
          updated_at: now,
        })
        .eq("id", o.id);
      if (uerr) result.errors.push(`export db ${o.id}: ${uerr.message}`);
      else result.exported += 1;
    }
  } catch (e) {
    result.errors.push(
      `export: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

/** Gera legendas via 9router para caption_status pending|none. */
async function generateCaptions(
  supabase: SupabaseClient,
  result: PipelineResult,
): Promise<void> {
  const { data: offers, error } = await supabase
    .from("offers")
    .select(
      "id, title, price_cents, url, source, status, caption, caption_status, sheets_row, updated_at",
    )
    .in("caption_status", ["pending", "none"])
    .in("status", ["new", "approved"])
    .order("scraped_at", { ascending: true })
    .limit(CAPTION_BATCH);

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

      // write-back Sheets se tiver linha
      if (isSheetsConfigured() && o.sheets_row) {
        try {
          const aff = await affiliateUrlFor(supabase, o.id);
          await updateRows(o.sheets_row, [
            offerToSheetRow(
              { ...o, caption, caption_status: "ready", updated_at: now },
              aff,
              now,
            ),
          ]);
          await supabase
            .from("offers")
            .update({ sheets_synced_at: now })
            .eq("id", o.id);
        } catch (e) {
          result.errors.push(
            `caption sheets ${o.id}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
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

/**
 * Lê planilha e aplica edições humanas (caption/status) se mais novas.
 * Colunas: 0=id 5=status 6=caption 7=caption_status
 */
async function importFromSheets(
  supabase: SupabaseClient,
  result: PipelineResult,
): Promise<void> {
  if (!isSheetsConfigured()) return;

  let values: string[][];
  try {
    values = await readRows();
  } catch (e) {
    result.errors.push(
      `import: ${e instanceof Error ? e.message : String(e)}`,
    );
    return;
  }
  if (values.length <= 1) return;

  for (let i = 1; i < values.length; i++) {
    const row = values[i] ?? [];
    const id = row[0]?.trim();
    if (!id) continue;

    const status = row[5]?.trim();
    const caption = row[6]?.trim() ?? "";
    const captionStatus = row[7]?.trim();

    // values[0] = header (sheet row 1); values[i] = sheet row i+1
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      sheets_row: i + 1,
    };

    if (caption) {
      patch.caption = caption;
      if (
        captionStatus === "ready" ||
        captionStatus === "pending" ||
        captionStatus === "failed" ||
        captionStatus === "none"
      ) {
        patch.caption_status = captionStatus;
      } else {
        patch.caption_status = "ready";
      }
    } else if (
      captionStatus === "ready" ||
      captionStatus === "pending" ||
      captionStatus === "failed" ||
      captionStatus === "none"
    ) {
      patch.caption_status = captionStatus;
    }

    if (
      status === "new" ||
      status === "approved" ||
      status === "rejected" ||
      status === "sent"
    ) {
      // não reabrir sent via sheet sem querer — só aplica se não for sent no sheet forçando downgrade de sent
      if (status !== "sent") patch.status = status;
    }

    const { error, data } = await supabase
      .from("offers")
      .update(patch)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) {
      result.errors.push(`import ${id}: ${error.message}`);
      continue;
    }
    if (data) result.imported += 1;
  }
}

/** Emite afiliado default se faltar link ok. */
async function ensureAffiliates(
  supabase: SupabaseClient,
  result: PipelineResult,
): Promise<void> {
  const { data: settings } = await supabase
    .from("app_settings")
    .select("default_affiliate_provider_id")
    .eq("id", 1)
    .maybeSingle();
  const providerId = settings?.default_affiliate_provider_id as
    | string
    | null
    | undefined;
  if (!providerId) return;

  const { data: offers, error } = await supabase
    .from("offers")
    .select("id")
    .eq("caption_status", "ready")
    .in("status", ["new", "approved"])
    .order("scraped_at", { ascending: true })
    .limit(BATCH);

  if (error) {
    result.errors.push(`affiliate: ${error.message}`);
    return;
  }
  if (!offers?.length) return;

  for (const o of offers) {
    const { data: link } = await supabase
      .from("affiliate_links")
      .select("id")
      .eq("offer_id", o.id)
      .eq("status", "ok")
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
): Promise<void> {
  const { data: settings } = await supabase
    .from("app_settings")
    .select("auto_dispatch_enabled, auto_dispatch_group_ids")
    .eq("id", 1)
    .maybeSingle();

  if (!settings?.auto_dispatch_enabled) return;
  const groupIds = (settings.auto_dispatch_group_ids ?? []) as string[];
  if (!groupIds.length) return;

  const { data: offers, error } = await supabase
    .from("offers")
    .select("id")
    .eq("caption_status", "ready")
    .in("status", ["new", "approved"])
    .order("scraped_at", { ascending: true })
    .limit(BATCH);

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
 * Orquestra: export Sheets → captions → import Sheets → affiliate → auto-enqueue.
 * DB canônico. Sheets espelho + revisão.
 */
export async function runOfferPipeline(
  supabase: SupabaseClient,
): Promise<PipelineResult> {
  const result: PipelineResult = {
    exported: 0,
    captioned: 0,
    imported: 0,
    affiliates: 0,
    enqueued: 0,
    errors: [],
  };

  await exportToSheets(supabase, result);
  await generateCaptions(supabase, result);
  await importFromSheets(supabase, result);
  await ensureAffiliates(supabase, result);
  await autoEnqueue(supabase, result);

  return result;
}
