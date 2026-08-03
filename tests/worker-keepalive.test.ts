import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/worker-client", () => ({
  workerFetch: vi.fn(),
}));

import { workerFetch } from "@/lib/worker-client";
import { wakeWorkerAndEnsureSession } from "@/lib/worker-keepalive";

describe("wakeWorkerAndEnsureSession", () => {
  beforeEach(() => {
    vi.mocked(workerFetch).mockReset();
  });

  it("health ok + connected → não chama start", async () => {
    vi.mocked(workerFetch).mockImplementation(async (path: string) => {
      if (path === "/health") {
        return {
          ok: true,
          data: { ok: true, sessionStatus: "connected" },
        } as never;
      }
      throw new Error(`unexpected ${path}`);
    });
    const r = await wakeWorkerAndEnsureSession({
      tries: 2,
      gapMs: 1,
      sleepFn: async () => {},
    });
    expect(r.healthOk).toBe(true);
    expect(r.sessionStatus).toBe("connected");
    expect(r.started).toBe(false);
    expect(vi.mocked(workerFetch)).toHaveBeenCalledTimes(1);
  });

  it("retry até health ok e start se não connected", async () => {
    let healthCalls = 0;
    vi.mocked(workerFetch).mockImplementation(async (path: string) => {
      if (path === "/health") {
        healthCalls += 1;
        if (healthCalls < 2) {
          return { ok: false, error: "Worker HTTP 502", status: 502 } as never;
        }
        return {
          ok: true,
          data: { ok: true, sessionStatus: "disconnected" },
        } as never;
      }
      if (path === "/session/start") {
        return { ok: true, data: { ok: true } } as never;
      }
      if (path === "/session") {
        return {
          ok: true,
          data: { status: "connecting", lastError: null },
        } as never;
      }
      throw new Error(`unexpected ${path}`);
    });
    const r = await wakeWorkerAndEnsureSession({
      tries: 3,
      gapMs: 1,
      sleepFn: async () => {},
    });
    expect(r.healthOk).toBe(true);
    expect(r.attempts).toBe(2);
    expect(r.started).toBe(true);
    expect(r.sessionStatus).toBe("connecting");
  });

  it("esgota tries se health nunca sobe", async () => {
    vi.mocked(workerFetch).mockResolvedValue({
      ok: false,
      error: "Worker offline",
      status: 503,
    } as never);
    const r = await wakeWorkerAndEnsureSession({
      tries: 2,
      gapMs: 1,
      sleepFn: async () => {},
    });
    expect(r.healthOk).toBe(false);
    expect(r.attempts).toBe(2);
    expect(r.started).toBe(false);
  });
});
