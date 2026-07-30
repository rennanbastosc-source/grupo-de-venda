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
  const result = await emitAffiliateLink(auth.supabase, {
    offerId: typeof body.offerId === "string" ? body.offerId : undefined,
    url: typeof body.url === "string" ? body.url : undefined,
    providerId: typeof body.providerId === "string" ? body.providerId : "",
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
