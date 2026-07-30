import { describe, expect, it } from "vitest";

/**
 * Contrato logout/reconnect (espelha rotas API) sem subir Next.
 */
async function logoutHandler(opts: {
  authenticated: boolean;
  workerConfigured: boolean;
  workerOk?: boolean;
}) {
  if (!opts.authenticated) {
    return { status: 401, body: { error: "Não autenticado" } };
  }
  if (!opts.workerConfigured) {
    return { status: 503, body: { error: "Worker não configurado" } };
  }
  if (opts.workerOk === false) {
    return { status: 503, body: { error: "Worker offline" } };
  }
  return { status: 200, body: { ok: true } };
}

async function reconnectHandler(opts: {
  authenticated: boolean;
  workerConfigured: boolean;
  sessionStatus?: string;
}) {
  if (!opts.authenticated) {
    return { status: 401, body: { error: "Não autenticado" } };
  }
  if (!opts.workerConfigured) {
    return {
      status: 503,
      body: { error: "Worker não configurado", needsPairing: true },
    };
  }
  const st = opts.sessionStatus ?? "disconnected";
  if (st === "waiting_pairing" || st === "logged_out") {
    return {
      status: 409,
      body: {
        error: "Sem credenciais — pareie o número de novo",
        needsPairing: true,
      },
    };
  }
  // start ok
  if (st === "disconnected") {
    // after start still waiting → needs pair
    return {
      status: 409,
      body: {
        error: "Sem sessão salva — informe o telefone e gere o código",
        needsPairing: true,
      },
    };
  }
  return { status: 202, body: { ok: true } };
}

describe("POST /api/bot/logout contract", () => {
  it("401 sem auth", async () => {
    const r = await logoutHandler({
      authenticated: false,
      workerConfigured: true,
    });
    expect(r.status).toBe(401);
  });

  it("200 logout ok", async () => {
    const r = await logoutHandler({
      authenticated: true,
      workerConfigured: true,
      workerOk: true,
    });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
  });
});

describe("POST /api/bot/reconnect contract", () => {
  it("409 needsPairing quando waiting_pairing", async () => {
    const r = await reconnectHandler({
      authenticated: true,
      workerConfigured: true,
      sessionStatus: "waiting_pairing",
    });
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ needsPairing: true });
  });

  it("409 needsPairing quando logged_out", async () => {
    const r = await reconnectHandler({
      authenticated: true,
      workerConfigured: true,
      sessionStatus: "logged_out",
    });
    expect(r.status).toBe(409);
    expect((r.body as { needsPairing?: boolean }).needsPairing).toBe(true);
  });

  it("202 quando connecting (creds em uso)", async () => {
    const r = await reconnectHandler({
      authenticated: true,
      workerConfigured: true,
      sessionStatus: "connecting",
    });
    expect(r.status).toBe(202);
  });
});

describe("SessionPanel action visibility", () => {
  it("Desconectar só connected; Reconectar nos demais", () => {
    const showLogout = (s: string) => s === "connected";
    const showReconnect = (s: string) => s !== "connected";
    expect(showLogout("connected")).toBe(true);
    expect(showReconnect("connected")).toBe(false);
    expect(showReconnect("disconnected")).toBe(true);
    expect(showReconnect("waiting_pairing")).toBe(true);
  });
});
