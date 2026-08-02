import { assertCronSecret } from "@/lib/cron-auth";
import { runOfferPipeline } from "@/lib/pipeline/run";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse, after } from "next/server";

export const maxDuration = 300;

// 202 + after(): compatível com o timeout ~30s do cron-job.org free.
export async function GET(request: Request) {
  const denied = assertCronSecret(request);
  if (denied) return denied;

  after(async () => {
    try {
      const supabase = createServiceClient();
      const result = await runOfferPipeline(supabase);
      console.log("cron pipeline:", JSON.stringify(result));
    } catch (e) {
      console.error(
        "cron pipeline falhou:",
        e instanceof Error ? e.message : e,
      );
    }
  });
  return NextResponse.json({ accepted: true }, { status: 202 });
}

export async function POST(request: Request) {
  return GET(request);
}
