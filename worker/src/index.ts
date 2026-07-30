import { startBaileys } from "./baileys/client.js";
import { setSessionStatus } from "./baileys/session.js";
import { createWorkerServer } from "./http/server.js";

const port = Number(process.env.PORT || 3100);

const server = createWorkerServer();
server.listen(port, () => {
  console.log(`[worker] listening on :${port}`);
});

// Boot: tenta sessão existente ou waiting_pairing (sem forçar QR eterno)
startBaileys().catch((e) => {
  setSessionStatus("disconnected", {
    lastError: e instanceof Error ? e.message : String(e),
  });
  console.error("[worker] baileys start failed", e);
});

