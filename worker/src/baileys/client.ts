import makeWASocket, {
  DisconnectReason,
  initAuthCreds,
  BufferJSON,
  proto,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestWaWebVersion,
  isJidBroadcast,
  isJidGroup,
  isJidNewsletter,
  isJidUser,
  isLidUser,
  type WASocket,
  type ConnectionState,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import { createAuthState, type AuthBundle } from "./auth-state.js";
import {
  clearQr,
  consumePairingRequest,
  setPairingCode,
  setQrDataUrl,
  setSessionStatus,
} from "./session.js";

const RECONNECT_MIN_MS = 5_000;
const RECONNECT_MAX_MS = 60_000;
const PAIRING_POLL_MS = 10_000;

let sock: WASocket | null = null;
let authBundle: AuthBundle | null = null;
let pendingPairingPhone: string | null = null;
let resumingPairing = false;
let connecting = false;
let stopping = false;
let reconnectAttempt = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

export function getSocket() {
  return sock;
}

function encryptionKey(): string | null {
  return process.env.WHATSAPP_SESSION_KEY || null;
}

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function schedule(delayMs: number) {
  clearTimer();
  if (stopping) return;
  timer = setTimeout(() => {
    void startBaileys();
  }, delayMs);
}

function scheduleReconnect() {
  const delay = Math.min(
    RECONNECT_MIN_MS * 2 ** reconnectAttempt,
    RECONNECT_MAX_MS,
  );
  reconnectAttempt += 1;
  schedule(delay);
}

function disconnectCode(err: unknown): number | undefined {
  if (err && typeof err === "object" && "output" in err) {
    return (err as { output?: { statusCode?: number } }).output?.statusCode;
  }
  return undefined;
}

function jidToPhone(jid: string | undefined): string | undefined {
  return jid?.split("@")[0]?.split(":")[0];
}

async function discardIncompleteAuth() {
  if (!authBundle || authBundle.state.creds.account) return;
  try {
    await authBundle.clearAuth();
    authBundle = null;
  } catch {
    // ignore
  }
}

async function loadAuth(): Promise<AuthBundle> {
  if (!authBundle) {
    authBundle = await createAuthState(
      {
        initAuthCreds,
        BufferJSON,
        proto,
        useMultiFileAuthState,
      },
      encryptionKey(),
    );
  }
  return authBundle;
}

function retireSocket(target: WASocket): boolean {
  try {
    target.ev.removeAllListeners("connection.update");
    target.ev.removeAllListeners("creds.update");
    target.end(undefined);
  } catch {
    // ignore
  }
  if (sock !== target) return false;
  sock = null;
  return true;
}

async function handleConnectionUpdate(
  target: WASocket,
  update: Partial<ConnectionState>,
) {
  const { connection, lastDisconnect, qr } = update;

  if (qr) {
    try {
      const qrDataUrl = await QRCode.toDataURL(qr);
      setQrDataUrl(qrDataUrl);
      setSessionStatus("qr", { lastError: null });
    } catch (e) {
      setSessionStatus("qr", {
        lastError: e instanceof Error ? e.message : "QR fail",
      });
    }

    if (pendingPairingPhone) {
      const phone = pendingPairingPhone;
      pendingPairingPhone = null;
      try {
        const code = await target.requestPairingCode(phone);
        setPairingCode(code);
        setSessionStatus("qr", { phone, lastError: null });
      } catch (e) {
        setSessionStatus("qr", {
          lastError:
            e instanceof Error ? e.message : "falha pairing code",
        });
      }
    }
    return;
  }

  if (connection === "open") {
    reconnectAttempt = 0;
    resumingPairing = false;
    clearTimer();
    clearQr();
    const phone = jidToPhone(target.user?.id) ?? null;
    setSessionStatus("connected", {
      phone,
      lastError: null,
      pairingCode: null,
      pairingCodeAt: null,
    });
    return;
  }

  if (connection !== "close") return;
  if (!retireSocket(target)) return;
  if (stopping) return;

  const code = disconnectCode(lastDisconnect?.error);

  if (code === DisconnectReason.restartRequired) {
    resumingPairing = true;
    setSessionStatus("connecting", { lastError: null });
    schedule(0);
    return;
  }

  if (code === DisconnectReason.loggedOut) {
    if (authBundle) {
      await authBundle.clearAuth().catch(() => {});
      authBundle = null;
    }
    resumingPairing = false;
    setSessionStatus("logged_out", {
      qrDataUrl: null,
      pairingCode: null,
      lastError: "Sessão encerrada no aparelho",
    });
    schedule(PAIRING_POLL_MS);
    return;
  }

  // Pareamento incompleto (sem account): volta a waiting_pairing.
  // Timeout COM account era o flap: forçava waiting_pairing + poll e
  // o dashboard/cron viam "precisa parear" com sessão válida no disco.
  const hasAccount = Boolean(authBundle?.state.creds.account);
  if (pendingPairingPhone !== null || (!hasAccount && code === DisconnectReason.timedOut)) {
    pendingPairingPhone = null;
    resumingPairing = false;
    await discardIncompleteAuth();
    setSessionStatus("waiting_pairing", {
      qrDataUrl: null,
      pairingCode: null,
      lastError:
        code === DisconnectReason.timedOut
          ? "timeout no pareamento"
          : null,
    });
    schedule(PAIRING_POLL_MS);
    return;
  }

  const msg =
    lastDisconnect?.error instanceof Error
      ? lastDisconnect.error.message
      : "conexão fechada";
  const detail =
    code != null ? `${msg} (code=${code})` : msg;
  console.warn("[worker] connection close", { code, hasAccount, detail });
  setSessionStatus("disconnected", {
    lastError: detail.slice(0, 300),
    qrDataUrl: null,
  });
  scheduleReconnect();
}

export async function startBaileys() {
  if (stopping || connecting) return;
  connecting = true;

  try {
    const auth = await loadAuth();

    // Gate: só sobe socket se account existe, pair pendente, ou resuming pair
    if (!auth.state.creds.account) {
      const phone = consumePairingRequest();
      if (!phone && !resumingPairing) {
        setSessionStatus("waiting_pairing", { lastError: null });
        schedule(PAIRING_POLL_MS);
        return;
      }
      pendingPairingPhone = phone;
    }

    setSessionStatus("connecting", { lastError: null });

    const version = await fetchLatestWaWebVersion({})
      .then((r) => r.version)
      .catch(() => undefined);

    // logger mínimo (Baileys exige pino-like); silencia ruído
    const silent = {
      level: "silent" as const,
      child() {
        return silent;
      },
      trace() {},
      debug() {},
      info() {},
      warn() {},
      error() {},
      fatal() {},
    };

    const next = makeWASocket({
      version,
      auth: {
        creds: auth.state.creds,
        keys: makeCacheableSignalKeyStore(auth.state.keys, silent as never),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logger: silent as any,
      printQRInTerminal: false,
      browser: ["Mac OS", "Safari", "1.0.0"],
      markOnlineOnConnect: false,
      syncFullHistory: false,
      qrTimeout: 60_000,
      // Send-only: não decrypta inbound. Bad MAC em log vinha de LID 1:1
      // (ex. 4041564225646.0), não só de @g.us — por isso ignora user/LID também.
      // Outbound POST /send (sendMessage) não passa por shouldIgnoreJid.
      generateHighQualityLinkPreview: true,
      shouldIgnoreJid: (jid) =>
        Boolean(
          isJidGroup(jid) ||
            isJidBroadcast(jid) ||
            isJidNewsletter(jid) ||
            isJidUser(jid) ||
            isLidUser(jid),
        ),
    });

    if (sock) retireSocket(sock);
    sock = next;

    next.ev.on("creds.update", () => {
      void auth.saveCreds().catch(() => {});
    });

    next.ev.on("connection.update", (update) => {
      void handleConnectionUpdate(next, update).catch((e) => {
        setSessionStatus("disconnected", {
          lastError: e instanceof Error ? e.message : String(e),
        });
      });
    });
  } catch (e) {
    setSessionStatus("disconnected", {
      lastError: e instanceof Error ? e.message : String(e),
    });
    scheduleReconnect();
  } finally {
    connecting = false;
  }
}

export async function requestPairing(phone: string) {
  const { setPairingRequest } = await import("./session.js");
  setPairingRequest(phone);
  setSessionStatus("waiting_pairing", {
    phone,
    lastError: null,
    pairingCode: null,
  });
  // força tentativa imediata
  clearTimer();
  resumingPairing = false;
  await startBaileys();
}

export async function logoutBaileys() {
  try {
    if (sock) await sock.logout();
  } catch {
    // ignore
  }
  if (authBundle) {
    await authBundle.clearAuth().catch(() => {});
    authBundle = null;
  }
  if (sock) {
    retireSocket(sock);
  }
  pendingPairingPhone = null;
  resumingPairing = false;
  setSessionStatus("logged_out", {
    qrDataUrl: null,
    pairingCode: null,
    lastError: "logout",
  });
  schedule(PAIRING_POLL_MS);
}

export function stopBaileys() {
  stopping = true;
  clearTimer();
  resumingPairing = false;
  pendingPairingPhone = null;
  authBundle = null;
  if (sock) retireSocket(sock);
}
