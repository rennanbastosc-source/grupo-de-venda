import { describe, expect, it } from "vitest";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { once } from "node:events";

/**
 * Mirrors worker requireWorkerSecret behavior without importing worker package
 * (keeps root tests free of baileys). Contract: header x-worker-secret.
 */
function checkSecret(got: string | string[] | undefined, expected: string) {
  return got === expected;
}

describe("worker secret contract", () => {
  it("rejects missing secret", () => {
    expect(checkSecret(undefined, "s3cret")).toBe(false);
  });

  it("accepts matching secret", () => {
    expect(checkSecret("s3cret", "s3cret")).toBe(true);
  });

  it("HTTP 401 without header (integration-ish)", async () => {
    const secret = "test-secret";
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.headers["x-worker-secret"] !== secret) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "unauthorized" }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    server.listen(0);
    await once(server, "listening");
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    const base = `http://127.0.0.1:${addr.port}`;

    const denied = await fetch(`${base}/session`);
    expect(denied.status).toBe(401);

    const ok = await fetch(`${base}/session`, {
      headers: { "x-worker-secret": secret },
    });
    expect(ok.status).toBe(200);

    server.close();
  });
});
