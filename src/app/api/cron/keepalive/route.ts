import { assertCronSecret } from "@/lib/cron-auth";
import { NextResponse } from "next/server";

/**
 * Keepalive do 9router (plano free da Render dorme após ~15min e perde
 * o sqlite no wake). Pinga o endpoint a cada 5 min via cron Vercel.
 */
export async function GET(request: Request) {
  const denied = assertCronSecret(request);
  if (denied) return denied;

  const base = process.env.NINE_ROUTER_BASE_URL;
  if (!base) {
    return NextResponse.json({ ok: true, skipped: "sem NINE_ROUTER_BASE_URL" });
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    const res = await fetch(`${base}/models`, {
      signal: ctrl.signal,
      // 401 é ok — o serviço respondeu (acordado)
      cache: "no-store",
    });
    clearTimeout(timer);
    return NextResponse.json({
      ok: true,
      status: res.status,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
