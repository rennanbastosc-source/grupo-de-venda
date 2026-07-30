import { describe, expect, it, beforeEach } from "vitest";
import { randomBytes } from "node:crypto";

// Testa módulos worker via path relativo (ESM)
import {
  getSessionState,
  setSessionStatus,
  setPairingCode,
  setQrDataUrl,
  setPairingRequest,
  consumePairingRequest,
  sessionPublicView,
  PAIRING_CODE_TTL_MS,
  PAIRING_QR_TTL_MS,
} from "../worker/src/baileys/session";
import { normalizePhone } from "../worker/src/baileys/phone";
import {
  encryptSession,
  decryptSession,
} from "../worker/src/baileys/crypto";
import { createWorkerServer } from "../worker/src/http/server";
import { once } from "node:events";

describe("normalizePhone", () => {
  it("prefixa 55 em 11 dígitos BR", () => {
    expect(normalizePhone("(11) 99999-9999")).toBe("5511999999999");
  });
  it("aceita já com 55", () => {
    expect(normalizePhone("5511999999999")).toBe("5511999999999");
  });
  it("rejeita curto", () => {
    expect(normalizePhone("123")).toBeNull();
  });
});

describe("session lifecycle (mailbox + TTL)", () => {
  beforeEach(() => {
    setSessionStatus("disconnected", {
      qrDataUrl: null,
      pairingCode: null,
      phone: null,
      lastError: null,
    });
    // drain pending
    consumePairingRequest();
  });

  it("waiting_pairing sem pedido", () => {
    setSessionStatus("waiting_pairing");
    const v = sessionPublicView();
    expect(v.status).toBe("waiting_pairing");
    expect(v.hasPairingCode).toBe(false);
    expect(v.hasQr).toBe(false);
  });

  it("pair grava phone e consome", () => {
    setPairingRequest("5511999999999");
    expect(consumePairingRequest()).toBe("5511999999999");
    expect(consumePairingRequest()).toBeNull();
  });

  it("TTL zera code e QR", () => {
    setPairingCode("ABCD1234");
    setQrDataUrl("data:image/png;base64,xx");
    setSessionStatus("qr");
    const expired = Date.now() + PAIRING_CODE_TTL_MS + PAIRING_QR_TTL_MS + 1000;
    const s = getSessionState(expired);
    expect(s.pairingCode).toBeNull();
    expect(s.qrDataUrl).toBeNull();
  });

  it("connected limpa qr/code", () => {
    setPairingCode("ABCD1234");
    setQrDataUrl("data:image/png;base64,xx");
    setSessionStatus("connected", { phone: "5511" });
    const s = getSessionState();
    expect(s.status).toBe("connected");
    expect(s.qrDataUrl).toBeNull();
    expect(s.pairingCode).toBeNull();
    expect(s.phone).toBe("5511");
  });
});

describe("crypto session", () => {
  it("roundtrip AES-GCM", () => {
    const key = randomBytes(32).toString("base64");
    const plain = JSON.stringify({ hello: "world", n: 1 });
    const enc = encryptSession(plain, key);
    expect(enc.split(".")).toHaveLength(3);
    expect(decryptSession(enc, key)).toBe(plain);
  });

  it("rejeita chave curta", () => {
    expect(() =>
      encryptSession("x", Buffer.from("short").toString("base64")),
    ).toThrow(/32 bytes/);
  });
});

describe("createAuthState load guard", () => {
  const deps = {
    initAuthCreds: () => ({ account: null, me: null, _fresh: true }),
    BufferJSON: {
      replacer: (_k: string, v: unknown) => v,
      reviver: (_k: string, v: unknown) => v,
    },
    proto: { Message: { AppStateSyncKeyData: { fromObject: (v: unknown) => v } } },
    useMultiFileAuthState: async () => ({
      state: { creds: {}, keys: {} },
      saveCreds: async () => {},
    }),
  };

  it("falha de REST não vira creds frescas (não sobrescreve)", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    const key = randomBytes(32).toString("base64");
    const prev = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          code: "PGRST205",
          message: "Could not find the table 'public.wa_session_keys'",
        }),
        { status: 404 },
      ) as Response;
    try {
      const { createAuthState } = await import("../worker/src/baileys/auth-state");
      await expect(createAuthState(deps, key)).rejects.toThrow(/Supabase REST 404/);
    } finally {
      globalThis.fetch = prev;
    }
  });

  it("payload ilegível não vira creds frescas", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    const key = randomBytes(32).toString("base64");
    const prev = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify([{ value: "not.a.valid.blob" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }) as Response;
    try {
      const { createAuthState } = await import("../worker/src/baileys/auth-state");
      await expect(createAuthState(deps, key)).rejects.toThrow(/ilegíveis/);
    } finally {
      globalThis.fetch = prev;
    }
  });
});

describe("worker HTTP pair/session contract", () => {
  it("401 sem secret; pair 400/202; session campos", async () => {
    process.env.WORKER_API_SECRET = "test-secret-lifecycle";
    // evita baileys real no pair: requestPairing chama startBaileys — ok se falhar async
    const server = createWorkerServer();
    server.listen(0);
    await once(server, "listening");
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    const base = `http://127.0.0.1:${addr.port}`;
    const h = { "x-worker-secret": "test-secret-lifecycle" };

    const denied = await fetch(`${base}/session`);
    expect(denied.status).toBe(401);

    const session = await fetch(`${base}/session`, { headers: h });
    expect(session.status).toBe(200);
    const body = (await session.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("hasQr");
    expect(body).toHaveProperty("hasPairingCode");
    expect(body).toHaveProperty("phone");

    const bad = await fetch(`${base}/session/pair`, {
      method: "POST",
      headers: { ...h, "content-type": "application/json" },
      body: JSON.stringify({ phone: "12" }),
    });
    expect(bad.status).toBe(400);

    const ok = await fetch(`${base}/session/pair`, {
      method: "POST",
      headers: { ...h, "content-type": "application/json" },
      body: JSON.stringify({ phone: "11999999999" }),
    });
    expect(ok.status).toBe(202);

    const send = await fetch(`${base}/send`, {
      method: "POST",
      headers: { ...h, "content-type": "application/json" },
      body: JSON.stringify({ jid: "x@g.us", text: "hi" }),
    });
    expect(send.status).toBe(409);

    server.close();
  });
});

