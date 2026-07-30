import { requireUser } from "@/lib/api-auth";
import {
  getWorkerSession,
  isWorkerConfigured,
  startWorkerSession,
} from "@/lib/worker-client";
import { NextResponse } from "next/server";

export async function POST() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  if (!isWorkerConfigured()) {
    return NextResponse.json(
      { error: "Worker não configurado", needsPairing: true },
      { status: 503 },
    );
  }

  // Se já está em waiting_pairing / logged_out sem sessão útil, oriente pair
  const before = await getWorkerSession();
  if (before.ok) {
    const st = before.data.status;
    if (st === "waiting_pairing" || st === "logged_out") {
      return NextResponse.json(
        {
          error: "Sem credenciais — pareie o número de novo",
          needsPairing: true,
        },
        { status: 409 },
      );
    }
  }

  const res = await startWorkerSession();
  if (!res.ok) {
    return NextResponse.json(
      { error: res.error, needsPairing: res.status === 409 },
      { status: res.status >= 500 ? 503 : res.status },
    );
  }

  // Após start, se worker reportar waiting_pairing → needsPairing
  const after = await getWorkerSession();
  if (after.ok && after.data.status === "waiting_pairing") {
    return NextResponse.json(
      {
        error: "Sem sessão salva — informe o telefone e gere o código",
        needsPairing: true,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 202 });
}
