import { requireUser } from "@/lib/api-auth";
import { isWorkerConfigured, pairWorkerSession } from "@/lib/worker-client";
import { normalizePhone } from "@/lib/wa/phone";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  if (!isWorkerConfigured()) {
    return NextResponse.json(
      { error: "Worker não configurado" },
      { status: 503 },
    );
  }

  let body: { phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const phone = normalizePhone(body.phone ?? "");
  if (!phone) {
    return NextResponse.json({ error: "phone inválido" }, { status: 400 });
  }

  const res = await pairWorkerSession(phone);
  if (!res.ok) {
    return NextResponse.json(
      { error: res.error },
      { status: res.status >= 500 ? 503 : res.status },
    );
  }

  return NextResponse.json({ ok: true, phone }, { status: 202 });
}
