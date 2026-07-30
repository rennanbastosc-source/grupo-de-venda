import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import path from "node:path";
import { clearQr, setSessionStatus } from "./session.js";

let sock: WASocket | null = null;

export function getSocket() {
  return sock;
}

function disconnectCode(err: unknown): number | undefined {
  if (err && typeof err === "object" && "output" in err) {
    const out = (err as { output?: { statusCode?: number } }).output;
    return out?.statusCode;
  }
  return undefined;
}

export async function startBaileys() {
  const authDir =
    process.env.BAILEYS_AUTH_DIR ||
    path.join(process.cwd(), "data", "auth");

  setSessionStatus("connecting", { lastError: null });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        const qrDataUrl = await QRCode.toDataURL(qr);
        setSessionStatus("qr", { qrDataUrl, lastError: null });
      } catch (e) {
        setSessionStatus("qr", {
          lastError: e instanceof Error ? e.message : "QR fail",
        });
      }
    }

    if (connection === "open") {
      clearQr();
      setSessionStatus("connected", { lastError: null });
    }

    if (connection === "close") {
      const code = disconnectCode(lastDisconnect?.error);
      const loggedOut = code === DisconnectReason.loggedOut;
      const msg =
        lastDisconnect?.error instanceof Error
          ? lastDisconnect.error.message
          : "conexão fechada";
      setSessionStatus("disconnected", {
        lastError: loggedOut
          ? "Sessão deslogada — escaneie QR novamente"
          : msg,
        qrDataUrl: null,
      });
      sock = null;
      if (!loggedOut) {
        setTimeout(() => {
          startBaileys().catch((err) => {
            setSessionStatus("disconnected", {
              lastError: err instanceof Error ? err.message : String(err),
            });
          });
        }, 3000);
      }
    }
  });
}
