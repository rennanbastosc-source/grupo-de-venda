import { assertCronSecret } from "@/lib/cron-auth";
import { processDispatchQueue } from "@/lib/dispatch/process";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const denied = assertCronSecret(request);
  if (denied) return denied;

  try {
    const supabase = createServiceClient();
    const result = await processDispatchQueue(supabase);
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
