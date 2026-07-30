import { requireUser } from "@/lib/api-auth";
import {
  getWorkerPairingCode,
  isWorkerConfigured,
} from "@/lib/worker-client";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  if (!isWorkerConfigured()) {
    return NextResponse.json({
      code: null,
      phone: null,
      at: null,
      error: "Worker não configurado",
    });
  }

  const res = await getWorkerPairingCode();
  if (!res.ok) {
    return NextResponse.json(
      { code: null, phone: null, at: null, error: res.error },
      { status: res.status >= 500 ? 503 : res.status },
    );
  }

  return NextResponse.json({
    code: res.data.code,
    phone: res.data.phone,
    at: res.data.at,
  });
}
