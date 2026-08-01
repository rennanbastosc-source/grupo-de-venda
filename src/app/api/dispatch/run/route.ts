import { requireUser } from "@/lib/api-auth";
import { processDispatchQueue } from "@/lib/dispatch/process";
import { NextResponse } from "next/server";

/** Admin-triggered queue processing (same as cron dispatch). */
export async function POST() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  try {
    const result = await processDispatchQueue(auth.supabase);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
