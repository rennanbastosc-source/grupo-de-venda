import { describe, expect, it } from "vitest";
import { normalizePhone } from "@/lib/wa/phone";

/**
 * Contrato da API pair sem subir Next: valida phone + simula auth gate e proxy worker.
 * Rotas reais usam requireUser + pairWorkerSession — espelhamos o fluxo.
 */
async function pairHandler(opts: {
  authenticated: boolean;
  workerConfigured: boolean;
  body: unknown;
  workerResponse?: { ok: true; data: { ok: boolean } } | { ok: false; error: string; status: number };
}) {
  if (!opts.authenticated) {
    return { status: 401, body: { error: "Não autenticado" } };
  }
  if (!opts.workerConfigured) {
    return { status: 503, body: { error: "Worker não configurado" } };
  }
  const phoneRaw =
    opts.body && typeof opts.body === "object" && "phone" in opts.body
      ? String((opts.body as { phone?: string }).phone ?? "")
      : "";
  const phone = normalizePhone(phoneRaw);
  if (!phone) {
    return { status: 400, body: { error: "phone inválido" } };
  }
  const wr = opts.workerResponse ?? { ok: true as const, data: { ok: true } };
  if (!wr.ok) {
    return {
      status: wr.status >= 500 ? 503 : wr.status,
      body: { error: wr.error },
    };
  }
  return { status: 202, body: { ok: true, phone } };
}

describe("POST /api/bot/pair contract", () => {
  it("401 sem auth", async () => {
    const r = await pairHandler({
      authenticated: false,
      workerConfigured: true,
      body: { phone: "11999999999" },
    });
    expect(r.status).toBe(401);
  });

  it("400 phone inválido", async () => {
    const r = await pairHandler({
      authenticated: true,
      workerConfigured: true,
      body: { phone: "12" },
    });
    expect(r.status).toBe(400);
  });

  it("503 worker off", async () => {
    const r = await pairHandler({
      authenticated: true,
      workerConfigured: false,
      body: { phone: "11999999999" },
    });
    expect(r.status).toBe(503);
  });

  it("202 com phone normalizado", async () => {
    const r = await pairHandler({
      authenticated: true,
      workerConfigured: true,
      body: { phone: "(11) 99999-9999" },
    });
    expect(r.status).toBe(202);
    expect(r.body).toEqual({ ok: true, phone: "5511999999999" });
  });
});

describe("SessionPanel smoke data shape", () => {
  it("form visível em status de pareamento; artefatos em qr", () => {
    const needsForm = (s: string) =>
      ["disconnected", "waiting_pairing", "logged_out"].includes(s);
    const showArtifacts = (s: string, code: string | null, qr: string | null) =>
      s === "qr" || s === "connecting" || Boolean(code) || Boolean(qr);

    expect(needsForm("disconnected")).toBe(true);
    expect(needsForm("connected")).toBe(false);
    expect(showArtifacts("qr", "ABCD1234", "data:x")).toBe(true);
    expect(showArtifacts("connected", null, null)).toBe(false);
  });
});

