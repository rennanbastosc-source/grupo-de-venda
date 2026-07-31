import { requireUser } from "@/lib/api-auth";
import { canonicalizeUrl } from "@/lib/scrapers/normalize";
import type { OfferStatus, ScrapeSource } from "@/lib/scrapers/types";
import { NextResponse } from "next/server";

const STATUSES = new Set<OfferStatus>([
  "new",
  "approved",
  "rejected",
  "sent",
]);
const SOURCES = new Set<ScrapeSource>([
  "mercadolivre",
  "amazon",
  "shopee",
  "manual",
]);

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const source = searchParams.get("source");

  let q = auth.supabase
    .from("offers")
    .select("*")
    .order("scraped_at", { ascending: false })
    .limit(100);

  if (status && STATUSES.has(status as OfferStatus)) {
    q = q.eq("status", status);
  }
  if (source && SOURCES.has(source as ScrapeSource)) {
    q = q.eq("source", source);
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ offers: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!title || !url) {
    return NextResponse.json(
      { error: "title e url obrigatórios" },
      { status: 400 },
    );
  }

  let urlCanonical: string;
  try {
    urlCanonical = canonicalizeUrl(url);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "URL inválida" },
      { status: 400 },
    );
  }

  let price_cents: number | null = null;
  if (body.price_cents !== undefined && body.price_cents !== null) {
    const n = Number(body.price_cents);
    if (!Number.isInteger(n) || n < 0) {
      return NextResponse.json(
        { error: "price_cents inválido" },
        { status: 400 },
      );
    }
    price_cents = n;
  }

  const { data, error } = await auth.supabase
    .from("offers")
    .insert({
      source: "manual",
      title,
      url,
      url_canonical: urlCanonical,
      price_cents,
      status: "new",
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "oferta já existe (url canônica)" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ offer: data }, { status: 201 });
}
