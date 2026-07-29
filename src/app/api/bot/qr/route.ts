import { requireUser } from "@/lib/api-auth";
import { getWorkerQr, isWorkerConfigured } from "@/lib/worker-client";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  if (!isWorkerConfigured()) {
    return NextResponse.json({ qrDataUrl: null, error: "Worker não configurado" });
  }

  const res = await getWorkerQr();
  if (!res.ok) {
    return NextResponse.json(
      { qrDataUrl: null, error: res.error },
      { status: res.status >= 500 ? 503 : res.status },
    );
  }
  return NextResponse.json({ qrDataUrl: res.data.qrDataUrl });
}
