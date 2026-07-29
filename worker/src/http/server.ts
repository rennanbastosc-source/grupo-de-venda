import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { requireWorkerSecret } from "../auth.js";
import { getSessionState, setSessionStatus } from "../baileys/session.js";
import { getSocket, startBaileys } from "../baileys/client.js";

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function readUrl(req: IncomingMessage) {
  return new URL(req.url || "/", "http://localhost");
}

export function createWorkerServer() {
  return createServer(async (req, res) => {
    const url = readUrl(req);
    const method = req.method || "GET";

    if (url.pathname === "/health") {
      return json(res, 200, { ok: true });
    }

    if (!requireWorkerSecret(req, res)) return;

    if (method === "GET" && url.pathname === "/session") {
      const s = getSessionState();
      return json(res, 200, {
        status: s.status,
        hasQr: Boolean(s.qrDataUrl),
        lastError: s.lastError,
      });
    }

    if (method === "GET" && url.pathname === "/session/qr") {
      const s = getSessionState();
      return json(res, 200, { qrDataUrl: s.qrDataUrl });
    }

    if (method === "POST" && url.pathname === "/session/logout") {
      try {
        const s = getSocket();
        if (s) await s.logout();
      } catch {
        // ignore
      }
      setSessionStatus("disconnected", {
        qrDataUrl: null,
        lastError: "logout",
      });
      return json(res, 200, { ok: true });
    }

    if (method === "POST" && url.pathname === "/session/start") {
      startBaileys().catch((e) => {
        setSessionStatus("disconnected", {
          lastError: e instanceof Error ? e.message : String(e),
        });
      });
      return json(res, 202, { ok: true });
    }

    return json(res, 404, { error: "not found" });
  });
}
