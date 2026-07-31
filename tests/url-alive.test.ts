import { afterEach, describe, expect, it, vi } from "vitest";
import { filterAliveOffers, isUrlAlive } from "@/lib/scrapers/url-alive";

describe("url-alive", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("404 → false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    );
    expect(await isUrlAlive("https://www.amazon.com.br/dp/DEAD")).toBe(false);
  });

  it("200 → true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    );
    expect(await isUrlAlive("https://www.amazon.com.br/dp/B0OK")).toBe(true);
  });

  it("403 → true (keep anti-bot)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 403 }),
    );
    expect(await isUrlAlive("https://shopee.com.br/product/1/2")).toBe(true);
  });

  it("HEAD 503 + GET 200 → true (Amazon responde 503 a todo HEAD)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (_u: string, init: RequestInit) => ({
        ok: init.method !== "HEAD",
        status: init.method === "HEAD" ? 503 : 200,
      })),
    );
    expect(await isUrlAlive("https://www.amazon.com.br/dp/B0876MJBG6")).toBe(
      true,
    );
  });

  // A Amazon serve ASIN inexistente como 500 (medido 4/5) ou 404 (1/5).
  it.each([404, 500])(
    "HEAD 503 + GET %i → false (ASIN alucinado)",
    async (getStatus) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(async (_u: string, init: RequestInit) => ({
          ok: false,
          status: init.method === "HEAD" ? 503 : getStatus,
        })),
      );
      expect(await isUrlAlive("https://www.amazon.com.br/dp/B08FJCZDG5")).toBe(
        false,
      );
    },
  );

  it("HEAD 503 + GET 429 → true (anti-bot não julga o recurso)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (_u: string, init: RequestInit) => ({
        ok: false,
        status: init.method === "HEAD" ? 503 : 429,
      })),
    );
    expect(await isUrlAlive("https://www.amazon.com.br/dp/B0876MJBG6")).toBe(
      true,
    );
  });

  it("rede throw → false (não propaga)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );
    expect(await isUrlAlive("https://example.com/x")).toBe(false);
  });

  it("filterAliveOffers remove só mortos", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        if (String(url).includes("DEAD")) {
          return { ok: false, status: 404 };
        }
        return { ok: true, status: 200 };
      }),
    );
    const kept = await filterAliveOffers([
      { title: "ok", url: "https://www.amazon.com.br/dp/B0OKOKOKOK" },
      { title: "dead", url: "https://www.amazon.com.br/dp/DEADDEADDE" },
    ]);
    expect(kept).toHaveLength(1);
    expect(kept[0].title).toBe("ok");
  });
});
