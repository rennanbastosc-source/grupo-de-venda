import { requireUser } from "@/lib/api-auth";
import { NextResponse } from "next/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SETTINGS_SELECT =
  "daily_cap, hourly_cap, min_interval_sec, daily_offer_cap, sleep_start, sleep_end, message_template, auto_dispatch_enabled, auto_dispatch_group_ids, default_affiliate_provider_id, updated_at";

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const DEFAULTS = {
  daily_cap: 35,
  hourly_cap: 10,
  min_interval_sec: 45,
  daily_offer_cap: 10,
  sleep_start: null as string | null,
  sleep_end: null as string | null,
  message_template:
    "{{caption}}\n\n🔗 {{affiliate_url}}",
  auto_dispatch_enabled: false,
  auto_dispatch_group_ids: [] as string[],
  default_affiliate_provider_id: null as string | null,
};

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { data, error } = await auth.supabase
    .from("app_settings")
    .select(SETTINGS_SELECT)
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    settings: data ?? DEFAULTS,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  for (const key of [
    "daily_cap",
    "hourly_cap",
    "min_interval_sec",
    "daily_offer_cap",
  ] as const) {
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

  if (body.auto_dispatch_enabled !== undefined) {
    if (typeof body.auto_dispatch_enabled !== "boolean") {
      return NextResponse.json(
        { error: "auto_dispatch_enabled deve ser boolean" },
        { status: 400 },
      );
    }
    patch.auto_dispatch_enabled = body.auto_dispatch_enabled;
  }

  if (body.auto_dispatch_group_ids !== undefined) {
    if (
      !Array.isArray(body.auto_dispatch_group_ids) ||
      !body.auto_dispatch_group_ids.every(
        (id: unknown) => typeof id === "string" && UUID_RE.test(id),
      )
    ) {
      return NextResponse.json(
        { error: "auto_dispatch_group_ids deve ser array de uuid" },
        { status: 400 },
      );
    }
    patch.auto_dispatch_group_ids = body.auto_dispatch_group_ids;
  }

  if (body.default_affiliate_provider_id !== undefined) {
    const v = body.default_affiliate_provider_id;
    if (v !== null && (typeof v !== "string" || !UUID_RE.test(v))) {
      return NextResponse.json(
        { error: "default_affiliate_provider_id deve ser uuid ou null" },
        { status: 400 },
      );
    }
    patch.default_affiliate_provider_id = v;
  }

  for (const key of ["sleep_start", "sleep_end"] as const) {
    if (body[key] !== undefined) {
      const v = body[key];
      if (v === null || v === "") {
        patch[key] = null;
      } else if (typeof v === "string" && HHMM_RE.test(v)) {
        patch[key] = v;
      } else {
        return NextResponse.json(
          { error: `${key} deve ser HH:MM ou null` },
          { status: 400 },
        );
      }
    }
  }

  const { data, error } = await auth.supabase
    .from("app_settings")
    .upsert({ id: 1, ...patch })
    .select(SETTINGS_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ settings: data });
}
