import { requireUser } from "@/lib/api-auth";
import {
  isWorkerConfigured,
  logoutWorkerSession,
} from "@/lib/worker-client";
import { NextResponse } from "next/server";

export async function POST() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  if (!isWorkerConfigured()) {
    return NextResponse.json(
      { error: "Worker não configurado" },
      { status: 503 },
    );
  }

  const res = await logoutWorkerSession();
  if (!res.ok) {
    return NextResponse.json(
      { error: res.error },
      { status: res.status >= 500 ? 503 : res.status },
    );
  }

  return NextResponse.json({ ok: true });
}
