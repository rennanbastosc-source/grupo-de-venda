import { hasSupabaseEnv, rest } from "../db.js";

export type SessionStatus =
  | "disconnected"
  | "waiting_pairing"
  | "qr"
  | "connecting"
  | "connected"
  | "logged_out";

export type SessionState = {
  status: SessionStatus;
  qrDataUrl: string | null;
  qrAt: number | null;
  pairingCode: string | null;
  pairingCodeAt: number | null;
  phone: string | null;
  lastError: string | null;
};

export const PAIRING_CODE_TTL_MS = 3 * 60 * 1000;
export const PAIRING_QR_TTL_MS = 60 * 1000;

const state: SessionState = {
  status: "disconnected",
  qrDataUrl: null,
  qrAt: null,
  pairingCode: null,
  pairingCodeAt: null,
  phone: null,
  lastError: null,
};

export function getSessionState(now = Date.now()): SessionState {
  const snap = { ...state };
  if (
    snap.pairingCode &&
    snap.pairingCodeAt &&
    now - snap.pairingCodeAt > PAIRING_CODE_TTL_MS
  ) {
    snap.pairingCode = null;
    snap.pairingCodeAt = null;
  }
  if (snap.qrDataUrl && snap.qrAt && now - snap.qrAt > PAIRING_QR_TTL_MS) {
    snap.qrDataUrl = null;
    snap.qrAt = null;
  }
  return snap;
}

/**
 * Auditoria append-only: fire-and-forget — telemetria nunca pode derrubar
 * a máquina de conexão (mesma filosofia do saveCreds().catch()).
 */
function logConnectionEvent(status: SessionStatus, detail: string | null) {
  if (!hasSupabaseEnv()) return;
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (process.env.SCRAPE_MOCK === "1" || url.includes("ci.supabase.co")) {
    return;
  }
  void rest("POST", "wa_connection_events", [{ status, detail }]).catch(
    () => {},
  );
}

export function setSessionStatus(
  status: SessionStatus,
  patch?: Partial<
    Pick<
      SessionState,
      | "qrDataUrl"
      | "qrAt"
      | "pairingCode"
      | "pairingCodeAt"
      | "phone"
      | "lastError"
    >
  >,
) {
  const changed = status !== state.status;
  state.status = status;
  if (patch?.qrDataUrl !== undefined) state.qrDataUrl = patch.qrDataUrl;
  if (patch?.qrAt !== undefined) state.qrAt = patch.qrAt;
  if (patch?.pairingCode !== undefined) state.pairingCode = patch.pairingCode;
  if (patch?.pairingCodeAt !== undefined)
    state.pairingCodeAt = patch.pairingCodeAt;
  if (patch?.phone !== undefined) state.phone = patch.phone;
  if (patch?.lastError !== undefined) state.lastError = patch.lastError;
  if (status === "connected" || status === "disconnected" || status === "logged_out") {
    if (patch?.qrDataUrl === undefined) {
      state.qrDataUrl = null;
      state.qrAt = null;
    }
    if (status === "connected" && patch?.pairingCode === undefined) {
      state.pairingCode = null;
      state.pairingCodeAt = null;
    }
  }
  // só transições reais viram evento (reconexão em loop não vira ruído)
  if (changed) logConnectionEvent(status, state.lastError);
}

export function clearQr() {
  state.qrDataUrl = null;
  state.qrAt = null;
}

export function setPairingCode(code: string) {
  state.pairingCode = code;
  state.pairingCodeAt = Date.now();
}

export function setQrDataUrl(qrDataUrl: string) {
  state.qrDataUrl = qrDataUrl;
  state.qrAt = Date.now();
}

/** Pedido de pareamento em memória (mailbox worker). */
let pendingPairPhone: string | null = null;

export function setPairingRequest(phone: string) {
  pendingPairPhone = phone;
  state.phone = phone;
  state.pairingCode = null;
  state.pairingCodeAt = null;
}

export function consumePairingRequest(): string | null {
  const p = pendingPairPhone;
  pendingPairPhone = null;
  return p;
}

export function peekPairingRequest(): string | null {
  return pendingPairPhone;
}

export function sessionPublicView(now = Date.now()) {
  const s = getSessionState(now);
  return {
    status: s.status,
    hasQr: Boolean(s.qrDataUrl),
    hasPairingCode: Boolean(s.pairingCode),
    phone: s.phone,
    lastError: s.lastError,
  };
}
