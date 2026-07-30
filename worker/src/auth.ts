import type { IncomingMessage, ServerResponse } from "node:http";

export function requireWorkerSecret(
  req: IncomingMessage,
  res: ServerResponse,
): boolean {
  const expected = process.env.WORKER_API_SECRET;
  if (!expected) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "WORKER_API_SECRET ausente" }));
    return false;
  }
  const got = req.headers["x-worker-secret"];
  if (got !== expected) {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "unauthorized" }));
    return false;
  }
  return true;
}
