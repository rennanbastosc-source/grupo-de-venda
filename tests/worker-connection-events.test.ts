import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { setSessionStatus } from "../worker/src/baileys/session";

const SB_URL = "https://sb.example.test";

describe("eventos de conexão (append-only)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", SB_URL);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "srk");
    vi.stubEnv("SCRAPE_MOCK", "");
    fetchMock = vi.fn(async () => new Response("", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    // baseline conhecido; zera o contador depois da possível transição
    setSessionStatus("disconnected", { lastError: null });
    fetchMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("transição real gera 1 POST com status e detail", async () => {
    setSessionStatus("connecting", { lastError: null });
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain("/rest/v1/wa_connection_events");
    const body = JSON.parse(String(init.body)) as {
      status: string;
      detail: string | null;
    }[];
    expect(body[0].status).toBe("connecting");
  });

  it("mesmo status repetido não gera evento", async () => {
    setSessionStatus("connecting");
    fetchMock.mockClear();
    setSessionStatus("connecting", { lastError: "x" });
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("detail carrega o lastError da transição", async () => {
    setSessionStatus("disconnected", { lastError: "socket caiu" });
    // garante transição a partir de outro status
    setSessionStatus("connecting", { lastError: null });
    fetchMock.mockClear();
    setSessionStatus("disconnected", { lastError: "socket caiu" });
    await Promise.resolve();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { detail: string | null }[];
    expect(body[0].detail).toBe("socket caiu");
  });

  it("falha do POST não lança (fire-and-forget)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("rede caiu"));
    expect(() =>
      setSessionStatus("qr", { lastError: null }),
    ).not.toThrow();
    await Promise.resolve();
  });

  it("sem envs Supabase não faz fetch", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    setSessionStatus("connected", { lastError: null });
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ci.supabase.co é guardado (AGENTS §11)", async () => {
    vi.stubEnv("SUPABASE_URL", "https://ci.supabase.co");
    setSessionStatus("waiting_pairing", { lastError: null });
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
