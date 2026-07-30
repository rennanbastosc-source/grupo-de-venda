import { requireUser } from "@/lib/api-auth";
import { assertJidUnique, validateGroupInput } from "@/lib/wa/groups";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { data, error } = await auth.supabase
    .from("wa_groups")
    .select("*")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ groups: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const parsed = validateGroupInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { data: existing } = await auth.supabase
    .from("wa_groups")
    .select("id, jid");
  const dup = assertJidUnique(parsed.value.jid, [], undefined, existing ?? []);
  if (dup) {
    return NextResponse.json({ error: dup }, { status: 409 });
  }

  const { data, error } = await auth.supabase
    .from("wa_groups")
    .insert({
      jid: parsed.value.jid,
      name: parsed.value.name,
      active: parsed.value.active ?? true,
      daily_limit: parsed.value.daily_limit ?? null,
      notes: parsed.value.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "jid já cadastrado" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ group: data }, { status: 201 });
}
