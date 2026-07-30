import type { WaSessionStatus } from "./types";

const STATUSES: WaSessionStatus[] = [
  "disconnected",
  "qr",
  "connecting",
  "connected",
];

export function isWaSessionStatus(v: unknown): v is WaSessionStatus {
  return typeof v === "string" && (STATUSES as string[]).includes(v);
}

export function mapSessionForUi(input: {
  status?: unknown;
  hasQr?: boolean;
  qrDataUrl?: string | null;
  lastError?: string | null;
}): {
  status: WaSessionStatus;
  hasQr: boolean;
  qrDataUrl: string | null;
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
  return {
    status,
    hasQr,
    qrDataUrl,
    lastError:
      typeof input.lastError === "string" ? input.lastError : null,
    canDispatch: status === "connected",
  };
}
