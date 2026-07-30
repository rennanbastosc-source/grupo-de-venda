import { requireUser } from "@/lib/api-auth";
import { getOverviewStats } from "@/lib/stats/overview";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  try {
    const stats = await getOverviewStats(auth.supabase);
    return NextResponse.json({ stats });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
