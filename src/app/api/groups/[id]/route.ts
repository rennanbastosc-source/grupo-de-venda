import { requireUser } from "@/lib/api-auth";
import { assertJidUnique, normalizeJid, validateGroupInput } from "@/lib/wa/groups";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body.name === "string") {
    if (!body.name.trim()) {
      return NextResponse.json({ error: "name obrigatório" }, { status: 400 });
    }
    patch.name = body.name.trim();
  }
  if (typeof body.jid === "string") {
    const check = validateGroupInput({ jid: body.jid, name: "x" });
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }
    const { data: existing } = await auth.supabase
      .from("wa_groups")
      .select("id, jid");
    const dup = assertJidUnique(check.value.jid, [], id, existing ?? []);
    if (dup) {
      return NextResponse.json({ error: dup }, { status: 409 });
    }
    patch.jid = normalizeJid(body.jid);
  }
  if (body.active !== undefined) patch.active = Boolean(body.active);
  if (body.daily_limit !== undefined) {
    if (body.daily_limit === null) patch.daily_limit = null;
    else {
      const n = Number(body.daily_limit);
      if (!Number.isInteger(n) || n < 1) {
        return NextResponse.json(
          { error: "daily_limit deve ser inteiro >= 1" },
          { status: 400 },
        );
      }
      patch.daily_limit = n;
    }
  }
  if (body.notes !== undefined) patch.notes = body.notes;

  const { data, error } = await auth.supabase
    .from("wa_groups")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Grupo não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ group: data });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;

  const { data, error } = await auth.supabase
    .from("wa_groups")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Grupo não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ group: data });
}
