import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function requireUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return { user: null, supabase: null as never, error: unauthorized() };
    }
    return { user, supabase, error: null };
  } catch {
    return { user: null, supabase: null as never, error: unauthorized() };
  }
}

function unauthorized() {
  return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
}
