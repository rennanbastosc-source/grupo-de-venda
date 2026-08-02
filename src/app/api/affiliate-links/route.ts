import { requireUser } from "@/lib/api-auth";
import { emitAffiliateLink } from "@/lib/affiliates/emit";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const offerId = searchParams.get("offerId");

  let q = auth.supabase
    .from("affiliate_links")
    .select(
      "id, offer_id, provider_id, original_url, affiliate_url, status, error, created_at, affiliate_providers(slug, name)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (offerId) q = q.eq("offer_id", offerId);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ links: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const offerId = typeof body.offerId === "string" ? body.offerId : undefined;
  const explicitProviderId =
    typeof body.providerId === "string" ? body.providerId.trim() : "";

  // Sem provider explícito: roteia por source da oferta, igual ao pipeline
  // (mercadolivre → provider ML; demais → generic-tag). Evita re-criar o bug
  // "URL Invalid" ao emitir oferta amazon com provider ML manualmente.
  let providerId = explicitProviderId;
  if (!providerId && offerId) {
    const { data: offer } = await auth.supabase
      .from("offers")
      .select("source")
      .eq("id", offerId)
      .maybeSingle();
    if (offer) {
      const slug =
        offer.source === "mercadolivre" ? "mercadolivre" : "generic-tag";
      const { data: prow } = await auth.supabase
        .from("affiliate_providers")
        .select("id")
        .eq("slug", slug)
        .eq("active", true)
        .maybeSingle();
      if (prow) {
        providerId = prow.id;
      } else {
        // fallback: provider padrão do app
        const { data: settings } = await auth.supabase
          .from("app_settings")
          .select("default_affiliate_provider_id")
          .eq("id", 1)
          .maybeSingle();
        providerId = settings?.default_affiliate_provider_id ?? "";
      }
    }
  }

  const result = await emitAffiliateLink(auth.supabase, {
    offerId,
    url: typeof body.url === "string" ? body.url : undefined,
    providerId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json(
    {
      id: result.link.id,
      affiliateUrl: result.link.affiliate_url,
      status: result.link.status,
      error: result.link.error,
    },
    { status: 201 },
  );
}
