import { assertCronSecret } from "@/lib/cron-auth";
import { wakeWorkerAndEnsureSession } from "@/lib/worker-keepalive";
import { NextResponse } from "next/server";

/**
 * Keepalive: 9router (IA) + worker Baileys (Render free).
 * Worker: GET /health com retry → se acordou e sessão ≠ connected, POST /session/start.
 */
export async function GET(request: Request) {
  const denied = assertCronSecret(request);
  if (denied) return denied;

  const nineBase = process.env.NINE_ROUTER_BASE_URL;
  let nine: { ok: boolean; status?: number; error?: string; skipped?: string } =
    { ok: true, skipped: "sem NINE_ROUTER_BASE_URL" };

  if (nineBase) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20_000);
      const res = await fetch(`${nineBase.replace(/\/$/, "")}/models`, {
        signal: ctrl.signal,
        cache: "no-store",
      });
      clearTimeout(timer);
      // 401 é ok — o serviço respondeu (acordado)
      nine = { ok: true, status: res.status };
    } catch (e) {
      nine = {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  const worker = await wakeWorkerAndEnsureSession();

  const ok = nine.ok && worker.healthOk;
  return NextResponse.json(
    {
      ok,
      nine,
      worker: {
        healthOk: worker.healthOk,
        attempts: worker.attempts,
        sessionStatus: worker.sessionStatus,
        started: worker.started,
        lastError: worker.lastError,
      },
    },
    { status: ok ? 200 : 502 },
  );
}

export async function POST(request: Request) {
  return GET(request);
}
