import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { once } from "node:events";

import { isJobSent, markJobSent } from "../worker/src/db";
import { createWorkerServer } from "../worker/src/http/server";
import { setSessionStatus } from "../worker/src/baileys/session";

const SECRET = "test-secret";
const SB_URL = "https://sb.example.test";

function stubEnv() {
  vi.stubEnv("WORKER_API_SECRET", SECRET);
  vi.stubEnv("SUPABASE_URL", SB_URL);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "srk");
}

describe("db: wa_sent_jobs", () => {
  beforeEach(() => stubEnv());
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("isJobSent true quando linha existe", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify([{ job_id: "j1" }]), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(isJobSent("j1")).resolves.toBe(true);
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("/rest/v1/wa_sent_jobs");
    expect(url).toContain("job_id=eq.j1");
  });

  it("isJobSent false quando vazio", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("[]", { status: 200 })),
    );
    await expect(isJobSent("j1")).resolves.toBe(false);
  });

  it("markJobSent faz upsert idempotente", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await markJobSent("j2");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain("wa_sent_jobs?on_conflict=job_id");
    expect(
      (init.headers as Record<string, string>).Prefer,
    ).toContain("merge-duplicates");
    expect(String(init.body)).toContain("j2");
  });
});

describe("worker /send dedupe durável", () => {
  const realFetch = globalThis.fetch;
  let base = "";
  let server: ReturnType<typeof createWorkerServer>;

  beforeEach(async () => {
    stubEnv();
    setSessionStatus("connected", { lastError: null });
    server = createWorkerServer();
    server.listen(0);
    await once(server, "listening");
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    base = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(() => {
    server.close();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    setSessionStatus("disconnected", { lastError: null });
  });

  /** Intercepta só as chamadas PostgREST; o resto vai pro fetch real. */
  function stubRest(handler: () => Promise<Response>) {
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith(SB_URL)) return handler();
      return realFetch(input, init);
    });
  }

  it("re-POST de job já entregue (Set vazio = restart) responde deduped sem enviar", async () => {
    stubRest(async () =>
      new Response(JSON.stringify([{ job_id: "job-1" }]), { status: 200 }),
    );
    // sem socket: se o dedupe não segurasse, cairia em 503
    const res = await realFetch(`${base}/send`, {
      method: "POST",
      headers: { "x-worker-secret": SECRET },
      body: JSON.stringify({ jid: "g@g.us", text: "oi", jobId: "job-1" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; deduped?: boolean };
    expect(body.ok).toBe(true);
    expect(body.deduped).toBe(true);
  });

  it("falha na consulta durável responde 500 sem enviar", async () => {
    stubRest(async () => new Response("boom", { status: 500 }));
    const res = await realFetch(`${base}/send`, {
      method: "POST",
      headers: { "x-worker-secret": SECRET },
      body: JSON.stringify({ jid: "g@g.us", text: "oi", jobId: "job-2" }),
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/dedupe check falhou/);
  });

  it("sem envs Supabase pula o check durável (segue pro socket → 503)", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const res = await realFetch(`${base}/send`, {
      method: "POST",
      headers: { "x-worker-secret": SECRET },
      body: JSON.stringify({ jid: "g@g.us", text: "oi", jobId: "job-3" }),
    });
    // socket indisponível — prova que não travou nem 500 no dedupe
    expect(res.status).toBe(503);
  });
});
