import { requireUser } from "@/lib/api-auth";
import { NextResponse } from "next/server";

const KINDS = new Set(["livelo", "meliuz", "generic"]);

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { data, error } = await auth.supabase
    .from("affiliate_providers")
    .select("id, slug, name, kind, config, active, created_at")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ providers: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const kind = typeof body.kind === "string" ? body.kind : "";
  if (!slug || !name || !KINDS.has(kind)) {
    return NextResponse.json(
      { error: "slug, name e kind (livelo|meliuz|generic) obrigatórios" },
      { status: 400 },
    );
  }

  const config =
    body.config && typeof body.config === "object" && !Array.isArray(body.config)
      ? body.config
      : {};

  const { data, error } = await auth.supabase
    .from("affiliate_providers")
    .insert({
      slug,
      name,
      kind,
      config,
      active: body.active !== false,
    })
    .select("id, slug, name, kind, config, active, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "slug já existe" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ provider: data }, { status: 201 });
}
