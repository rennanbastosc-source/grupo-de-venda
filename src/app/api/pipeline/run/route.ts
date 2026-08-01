import { requireUser } from "@/lib/api-auth";
import { runOfferPipeline } from "@/lib/pipeline/run";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const maxDuration = 300;

/** Admin-triggered pipeline (same steps as cron): export→caption→import→affiliate→enqueue. */
export async function POST() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  try {
    const supabase = createServiceClient();
    const result = await runOfferPipeline(supabase);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
