import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { requireWorkerSecret } from "../auth.js";
import {
  getSessionState,
  sessionPublicView,
  setSessionStatus,
} from "../baileys/session.js";
import {
  getSocket,
  logoutBaileys,
  requestPairing,
  startBaileys,
} from "../baileys/client.js";
import { normalizePhone } from "../baileys/phone.js";

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function readUrl(req: IncomingMessage) {
  return new URL(req.url || "/", "http://localhost");
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const sentJobIds = new Set<string>();

export function createWorkerServer() {
  return createServer(async (req, res) => {
    const url = readUrl(req);
    const method = req.method || "GET";

    if (url.pathname === "/health") {
      return json(res, 200, { ok: true });
    }

    if (!requireWorkerSecret(req, res)) return;

    if (method === "GET" && url.pathname === "/session") {
      return json(res, 200, sessionPublicView());
    }

    if (method === "GET" && url.pathname === "/session/qr") {
      const s = getSessionState();
      return json(res, 200, { qrDataUrl: s.qrDataUrl });
    }

    if (method === "GET" && url.pathname === "/session/pairing-code") {
      const s = getSessionState();
      return json(res, 200, {
        code: s.pairingCode,
        phone: s.phone,
        at: s.pairingCodeAt,
      });
    }

    if (method === "POST" && url.pathname === "/session/pair") {
      let body: { phone?: string };
      try {
        body = JSON.parse(await readBody(req));
      } catch {
        return json(res, 400, { error: "JSON inválido" });
      }
      const phone = normalizePhone(body.phone ?? "");
      if (!phone) {
        return json(res, 400, { error: "phone inválido" });
      }
      void requestPairing(phone).catch((e) => {
        setSessionStatus("disconnected", {
          lastError: e instanceof Error ? e.message : String(e),
        });
      });
      return json(res, 202, { ok: true, phone });
    }

    if (method === "POST" && url.pathname === "/session/logout") {
      await logoutBaileys();
      return json(res, 200, { ok: true });
    }

    if (method === "POST" && url.pathname === "/session/start") {
      void startBaileys().catch((e) => {
        setSessionStatus("disconnected", {
          lastError: e instanceof Error ? e.message : String(e),
        });
      });
      return json(res, 202, { ok: true });
    }

    if (method === "GET" && url.pathname === "/groups") {
      const socket = getSocket();
      if (!socket) {
        return json(res, 503, { error: "socket indisponível" });
      }
      try {
        const groups = await socket.groupFetchAllParticipating();
        const list = Object.entries(groups).map(([jid, g]) => ({
          jid,
          name: g.subject ?? "",
          participantCount: g.participants?.length ?? 0,
        }));
        return json(res, 200, { groups: list });
      } catch (e) {
        return json(res, 500, {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    if (method === "POST" && url.pathname === "/send") {
      const s = getSessionState();
      if (s.status !== "connected") {
        return json(res, 409, {
          error: `session ${s.status}`,
        });
      }
      let body: { jid?: string; text?: string; jobId?: string };
      try {
        body = JSON.parse(await readBody(req));
      } catch {
        return json(res, 400, { error: "JSON inválido" });
      }
      const jid = typeof body.jid === "string" ? body.jid.trim() : "";
      const text = typeof body.text === "string" ? body.text : "";
      if (!jid || !text) {
        return json(res, 400, { error: "jid e text obrigatórios" });
      }
      if (body.jobId && sentJobIds.has(body.jobId)) {
        return json(res, 200, { ok: true, jobId: body.jobId, deduped: true });
      }
      const socket = getSocket();
      if (!socket) {
        return json(res, 503, { error: "socket indisponível" });
      }
      try {
        await socket.sendMessage(jid, { text });
        if (body.jobId) sentJobIds.add(body.jobId);
        return json(res, 200, { ok: true, jobId: body.jobId });
      } catch (e) {
        return json(res, 500, {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return json(res, 404, { error: "not found" });
  });
}
