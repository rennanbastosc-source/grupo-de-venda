import { assertCronSecret } from "@/lib/cron-auth";
import { runOfferPipeline } from "@/lib/pipeline/run";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const maxDuration = 120;

export async function GET(request: Request) {
  const denied = assertCronSecret(request);
  if (denied) return denied;

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

export async function POST(request: Request) {
  return GET(request);
}
