import { requireUser } from "@/lib/api-auth";
import { runScrape } from "@/lib/scrapers/run-pipeline";
import { createSupabaseOfferStore } from "@/lib/scrapers/supabase-store";
import type { ScrapeSource } from "@/lib/scrapers/types";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/** Admin-triggered scrape (same pipeline as cron). */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const source = body.source as Exclude<ScrapeSource, "manual"> | undefined;

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && serviceKey) {
      const supabase = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const result = await runScrape(createSupabaseOfferStore(supabase), source);
      return NextResponse.json(result);
    }
    const result = await runScrape(
      createSupabaseOfferStore(auth.supabase),
      source,
    );
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
