import type { WaSessionStatus } from "./types";

const STATUSES: WaSessionStatus[] = [
  "disconnected",
  "waiting_pairing",
  "qr",
  "connecting",
  "connected",
  "logged_out",
];

export function isWaSessionStatus(v: unknown): v is WaSessionStatus {
  return typeof v === "string" && (STATUSES as string[]).includes(v);
}

export function mapSessionForUi(input: {
  status?: unknown;
  hasQr?: boolean;
  hasPairingCode?: boolean;
  qrDataUrl?: string | null;
  pairingCode?: string | null;
  phone?: string | null;
  lastError?: string | null;
}): {
  status: WaSessionStatus;
  hasQr: boolean;
  hasPairingCode: boolean;
  qrDataUrl: string | null;
  pairingCode: string | null;
  phone: string | null;
  lastError: string | null;
  canDispatch: boolean;
} {
  const status = isWaSessionStatus(input.status)
    ? input.status
    : "disconnected";
  const qrDataUrl =
    typeof input.qrDataUrl === "string" && input.qrDataUrl.startsWith("data:")
      ? input.qrDataUrl
      : null;
  const hasQr =
    input.hasQr !== undefined ? Boolean(input.hasQr) : Boolean(qrDataUrl);
  const pairingCode =
    typeof input.pairingCode === "string" && input.pairingCode.length > 0
      ? input.pairingCode
      : null;
  const hasPairingCode =
    input.hasPairingCode !== undefined
      ? Boolean(input.hasPairingCode)
      : Boolean(pairingCode);
  const phone =
    typeof input.phone === "string" && input.phone.length > 0
      ? input.phone
      : null;
  return {
    status,
    hasQr,
    hasPairingCode,
    qrDataUrl,
    pairingCode,
    phone,
    lastError:
      typeof input.lastError === "string" ? input.lastError : null,
    canDispatch: status === "connected",
  };
}
