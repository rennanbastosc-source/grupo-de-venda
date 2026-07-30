import { requireUser } from "@/lib/api-auth";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { data, error } = await auth.supabase
    .from("app_settings")
    .select(
      "daily_cap, hourly_cap, min_interval_sec, message_template, updated_at",
    )
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    settings: data ?? {
      daily_cap: 35,
      hourly_cap: 10,
      min_interval_sec: 45,
      message_template: "🔥 {{title}}\n💰 {{price}}\n🔗 {{affiliate_url}}",
    },
  });
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  for (const key of ["daily_cap", "hourly_cap", "min_interval_sec"] as const) {
    if (body[key] !== undefined) {
      const n = Number(body[key]);
      if (!Number.isInteger(n) || n < 1) {
        return NextResponse.json(
          { error: `${key} deve ser inteiro ≥ 1` },
          { status: 400 },
        );
      }
      patch[key] = n;
    }
  }
  if (typeof body.message_template === "string") {
    const t = body.message_template.trim();
    if (!t.includes("{{affiliate_url}}")) {
      return NextResponse.json(
        { error: "template deve incluir {{affiliate_url}}" },
        { status: 400 },
      );
    }
    patch.message_template = t;
  }

  const { data, error } = await auth.supabase
    .from("app_settings")
    .upsert({ id: 1, ...patch })
    .select(
      "daily_cap, hourly_cap, min_interval_sec, message_template, updated_at",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ settings: data });
}
