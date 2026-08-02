import { assertCronSecret } from "@/lib/cron-auth";
import { processDispatchQueue } from "@/lib/dispatch/process";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse, after } from "next/server";

// Burst de até 15 grupos com jitter 2–5s leva ~75s; folga para retry/reap.
export const maxDuration = 300;

// 202 + after(): o agendador externo (cron-job.org aborta em ~30s) só
// aperta a campainha; o trabalho corre em background até maxDuration.
export async function GET(request: Request) {
  const denied = assertCronSecret(request);
  if (denied) return denied;

  after(async () => {
    try {
      const supabase = createServiceClient();
      const result = await processDispatchQueue(supabase);
      console.log("cron dispatch:", JSON.stringify(result));
    } catch (e) {
      console.error(
        "cron dispatch falhou:",
        e instanceof Error ? e.message : e,
      );
    }
  });
  return NextResponse.json({ accepted: true }, { status: 202 });
}

export async function POST(request: Request) {
  return GET(request);
}
