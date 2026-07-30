import { requireUser } from "@/lib/api-auth";
import { getWorkerSession, isWorkerConfigured } from "@/lib/worker-client";
import { mapSessionForUi } from "@/lib/wa/session";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  if (!isWorkerConfigured()) {
    return NextResponse.json(
      mapSessionForUi({
        status: "disconnected",
        lastError: "WORKER_BASE_URL / WORKER_API_SECRET não configurados",
      }),
    );
  }

  const res = await getWorkerSession();
  if (!res.ok) {
    return NextResponse.json(
      mapSessionForUi({
        status: "disconnected",
        lastError: res.error,
      }),
    );
  }

  return NextResponse.json(
    mapSessionForUi({
      status: res.data.status,
      hasQr: res.data.hasQr,
      hasPairingCode: res.data.hasPairingCode,
      phone: res.data.phone,
      lastError: res.data.lastError,
    }),
  );
}
