import { requireUser } from "@/lib/api-auth";
import { getWorkerSession, isWorkerConfigured, workerSend } from "@/lib/worker-client";
import { NextResponse } from "next/server";

const MAX = 200;

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  if (!isWorkerConfigured()) {
    return NextResponse.json(
      { error: "Worker não configurado" },
      { status: 503 },
    );
  }

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "text obrigatório" }, { status: 400 });
  }
  if (text.length > MAX) {
    return NextResponse.json(
      { error: `text máx. ${MAX} caracteres` },
      { status: 400 },
    );
  }

  const session = await getWorkerSession();
  if (!session.ok) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }
  if (session.data.status !== "connected") {
    return NextResponse.json(
      { error: `WhatsApp ${session.data.status} — conecte em /dashboard/bot` },
      { status: 409 },
    );
  }
  const phone = session.data.phone?.replace(/\D/g, "") || null;
  if (!phone) {
    return NextResponse.json(
      { error: "Número do bot desconhecido — reconecte a sessão" },
      { status: 409 },
    );
  }

  const jid = `${phone}@s.whatsapp.net`;
  const sent = await workerSend({ jid, text, jobId: `test-${Date.now()}` });
  if (!sent.ok) {
    return NextResponse.json(
      { error: sent.error },
      { status: sent.status || 502 },
    );
  }

  return NextResponse.json({ ok: true, phone, jid });
}
