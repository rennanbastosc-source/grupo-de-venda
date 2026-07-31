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
