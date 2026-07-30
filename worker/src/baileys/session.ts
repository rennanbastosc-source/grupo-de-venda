export type SessionStatus =
  | "disconnected"
  | "qr"
  | "connecting"
  | "connected";

export type SessionState = {
  status: SessionStatus;
  qrDataUrl: string | null;
  lastError: string | null;
};

const state: SessionState = {
  status: "disconnected",
  qrDataUrl: null,
  lastError: null,
};

export function getSessionState(): SessionState {
  return { ...state };
}

export function setSessionStatus(
  status: SessionStatus,
  patch?: Partial<Pick<SessionState, "qrDataUrl" | "lastError">>,
) {
  state.status = status;
  if (patch?.qrDataUrl !== undefined) state.qrDataUrl = patch.qrDataUrl;
  if (patch?.lastError !== undefined) state.lastError = patch.lastError;
  if (status === "connected" || status === "disconnected") {
    if (patch?.qrDataUrl === undefined) state.qrDataUrl = null;
  }
}

export function clearQr() {
  state.qrDataUrl = null;
}
