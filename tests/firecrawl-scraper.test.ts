import { afterEach, describe, expect, it, vi } from "vitest";
import { scrapeOffersFromUrl } from "@/lib/scrapers/firecrawl";

describe("scrapeOffersFromUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.FIRECRAWL_API_KEY;
  });

  it("throws without API key", async () => {
    await expect(
      scrapeOffersFromUrl("https://example.com", "extraia ofertas"),
    ).rejects.toThrow(/FIRECRAWL_API_KEY/);
  });

  it("maps extract.offers from Firecrawl response", async () => {
    process.env.FIRECRAWL_API_KEY = "fc-test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            extract: {
              offers: [
                {
                  title: "Fone BT",
                  url: "https://www.mercadolivre.com.br/fone/p/MLB1",
                  priceCents: 9990,
                  externalId: "MLB1",
                },
              ],
            },
          },
        }),
      }),
    );
    const offers = await scrapeOffersFromUrl(
      "https://lista.mercadolivre.com.br/ofertas",
      "extraia ofertas",
    );
    expect(offers).toHaveLength(1);
    expect(offers[0].title).toBe("Fone BT");
    expect(offers[0].priceCents).toBe(9990);
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://api.firecrawl.dev/v1/scrape");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer fc-test");
    const body = JSON.parse(init.body);
    expect(body.url).toContain("mercadolivre");
    expect(body.formats).toContain("extract");
    expect(body.extract.schema).toBeDefined();
  });

  it("throws on non-OK HTTP", async () => {
    process.env.FIRECRAWL_API_KEY = "fc-test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 402,
        text: async () => "payment required",
        json: async () => ({}),
      }),
    );
    await expect(
      scrapeOffersFromUrl("https://example.com", "x"),
    ).rejects.toThrow(/402/);
  });

  it("coerces fractional price in reais to cents", async () => {
    process.env.FIRECRAWL_API_KEY = "fc-test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            extract: {
              offers: [
                { title: "Mouse", url: "https://x.com/p", priceCents: 49.9 },
              ],
            },
          },
        }),
      }),
    );
    const offers = await scrapeOffersFromUrl("https://x.com", "x");
    expect(offers[0].priceCents).toBe(4990);
  });

  it("caps max offers", async () => {
    process.env.FIRECRAWL_API_KEY = "fc-test";
    const many = Array.from({ length: 30 }, (_, i) => ({
      title: `Item ${i}`,
      url: `https://example.com/p/${i}`,
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { extract: { offers: many } },
        }),
      }),
    );
    const offers = await scrapeOffersFromUrl("https://example.com", "x", {
      max: 15,
    });
    expect(offers).toHaveLength(15);
  });

  it("inclui headers no payload quando opts.headers é fornecido", async () => {
    process.env.FIRECRAWL_API_KEY = "fc-test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { extract: { offers: [] } },
        }),
      }),
    );
    await scrapeOffersFromUrl("https://example.com", "x", {
      headers: { Cookie: "ssid=abc" },
    });
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.headers).toEqual({ Cookie: "ssid=abc" });
  });
});
