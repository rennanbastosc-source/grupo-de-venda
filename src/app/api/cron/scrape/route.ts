import { assertCronSecret } from "@/lib/cron-auth";
import { runScrape } from "@/lib/scrapers/run-pipeline";
import { createSupabaseOfferStore } from "@/lib/scrapers/supabase-store";
import type { ScrapeSource } from "@/lib/scrapers/types";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const ACTIVE = new Set(["mercadolivre", "amazon", "shopee", "magalu"]);

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service role não configurado");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(request: Request) {
  const denied = assertCronSecret(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const sourceParam = searchParams.get("source");
  let source: Exclude<ScrapeSource, "manual"> | undefined;
  if (sourceParam) {
    if (!ACTIVE.has(sourceParam)) {
      return NextResponse.json({ error: "source inválida" }, { status: 400 });
    }
    source = sourceParam as Exclude<ScrapeSource, "manual">;
  }

  try {
    const supabase = serviceClient();
    const store = createSupabaseOfferStore(supabase);
    const result = await runScrape(store, source);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
