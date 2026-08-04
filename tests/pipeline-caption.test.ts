import { afterEach, describe, expect, it, vi } from "vitest";

describe("generateCaption", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("SCRAPE_MOCK retorna template sem rede", async () => {
    vi.stubEnv("SCRAPE_MOCK", "1");
    const { generateCaption } = await import("@/lib/ai/caption");
    const text = await generateCaption({
      title: "Fone X",
      price: "R$ 10,00",
      url: "https://ex.com/x",
    });
    expect(text).toContain("URUBU");
    expect(text).not.toContain("http");
  });

  it("chama OpenAI-compat e devolve content", async () => {
    vi.stubEnv("SCRAPE_MOCK", "");
    vi.stubEnv("NINE_ROUTER_BASE_URL", "http://router.test/v1");
    vi.stubEnv("NINE_ROUTER_MODEL", "GeMiNi");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "  Legenda top  " } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { generateCaption } = await import("@/lib/ai/caption");
    const text = await generateCaption({
      title: "Fone X",
      price: "R$ 10,00",
      url: "https://ex.com/x",
    });
    expect(text).toBe("Legenda top");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://router.test/v1/chat/completions");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("GeMiNi");
    expect(body.temperature).toBe(0.85);
    const system = body.messages[0].content as string;
    expect(system).toMatch(/70/);
    expect(system).toMatch(/MAIÚSCULAS/);
    expect(system).toMatch(/PROIBIDO: NÃO mencione preço/);
  });

  it("sem preço válido: system proíbe mencionar preço", async () => {
    vi.stubEnv("SCRAPE_MOCK", "");
    vi.stubEnv("NINE_ROUTER_BASE_URL", "http://router.test/v1");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "GANCHO DO URUBU" } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { generateCaption } = await import("@/lib/ai/caption");
    await generateCaption({
      title: "Produto X",
      price: "—",
      url: "https://ex.com/x",
    });
    const body = JSON.parse(
      String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body),
    );
    const system = body.messages[0].content as string;
    expect(system).toMatch(/PROIBIDO: NÃO mencione preço/);
  });
});

describe("buildMessage caption", () => {
  it("usa caption e não cai no title se vazio", async () => {
    const { buildMessage } = await import("@/lib/dispatch/template");
    expect(
      buildMessage("{{caption}}\n🔗 {{affiliate_url}}", {
        title: "T",
        price: "R$ 1",
        affiliate_url: "https://a",
        caption: "Promo boa",
      }),
    ).toContain("Promo boa");
    expect(
      buildMessage("{{caption}}", {
        title: "Título",
        price: "R$ 1",
        affiliate_url: "https://a",
        caption: "",
      }),
    ).not.toContain("Título");
  });
});

describe("isSheetsConfigured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("false com SCRAPE_MOCK", async () => {
    vi.stubEnv("SCRAPE_MOCK", "1");
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL", "a@b.com");
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "k");
    vi.stubEnv("GOOGLE_SHEETS_SPREADSHEET_ID", "sheet");
    const { isSheetsConfigured } = await import("@/lib/sheets/client");
    expect(isSheetsConfigured()).toBe(false);
  });

  it("true com envs", async () => {
    vi.stubEnv("SCRAPE_MOCK", "");
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL", "a@b.com");
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "k");
    vi.stubEnv("GOOGLE_SHEETS_SPREADSHEET_ID", "sheet");
    const { isSheetsConfigured } = await import("@/lib/sheets/client");
    expect(isSheetsConfigured()).toBe(true);
  });
});
