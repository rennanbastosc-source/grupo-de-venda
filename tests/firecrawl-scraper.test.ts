import { afterEach, describe, expect, it, vi } from "vitest";
import { scrapeOffersFromUrl } from "@/lib/scrapers/firecrawl";

const AMAZON_OPTS = {
  hostIncludes: "amazon.com.br",
  hrefPattern: /\/dp\/[A-Z0-9]{10}|\/gp\/product\//i,
};

const ML_OPTS = {
  hostIncludes: "mercadolivre.com.br",
  hrefPattern: /\/p\/MLB|\/up\/MLB|MLB\d+/i,
};

describe("scrapeOffersFromUrl (harvest links+html)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.FIRECRAWL_API_KEY;
  });

  it("throws without API key", async () => {
    await expect(
      scrapeOffersFromUrl("https://example.com", AMAZON_OPTS),
    ).rejects.toThrow(/FIRECRAWL_API_KEY/);
  });

  it("harvests product links from data.links without extract", async () => {
    process.env.FIRECRAWL_API_KEY = "fc-test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            links: [
              "https://www.amazon.com.br/dp/B0REALASIN12",
              "https://www.amazon.com.br/b?node=16215715011",
              "https://www.amazon.com.br/gp/product/B0876MJBG6",
            ],
            html: "",
          },
        }),
      }),
    );
    const offers = await scrapeOffersFromUrl(
      "https://www.amazon.com.br/gp/goldbox",
      AMAZON_OPTS,
    );
    expect(offers).toHaveLength(2);
    expect(offers.map((o) => o.url)).toContain(
      "https://www.amazon.com.br/dp/B0REALASIN12",
    );
    expect(offers.map((o) => o.url)).not.toContain(
      "https://www.amazon.com.br/b?node=16215715011",
    );

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://api.firecrawl.dev/v1/scrape");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer fc-test");
    const body = JSON.parse(init.body);
    expect(body.formats).toEqual(expect.arrayContaining(["links", "html"]));
    expect(body.formats).not.toContain("extract");
    expect(body.extract).toBeUndefined();
  });

  it("prefers title from html anchors", async () => {
    process.env.FIRECRAWL_API_KEY = "fc-test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            links: [],
            html: `<a href="https://www.mercadolivre.com.br/fone/p/MLB1">Fone BT</a>`,
          },
        }),
      }),
    );
    const offers = await scrapeOffersFromUrl(
      "https://www.mercadolivre.com.br/ofertas",
      ML_OPTS,
    );
    expect(offers).toHaveLength(1);
    expect(offers[0].title).toBe("Fone BT");
    expect(offers[0].url).toContain("/p/MLB1");
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
      scrapeOffersFromUrl("https://example.com", AMAZON_OPTS),
    ).rejects.toThrow(/402/);
  });

  it("caps max offers", async () => {
    process.env.FIRECRAWL_API_KEY = "fc-test";
    const many = Array.from(
      { length: 30 },
      (_, i) =>
        `https://www.amazon.com.br/dp/B0${String(i).padStart(8, "0")}`,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { links: many, html: "" },
        }),
      }),
    );
    const offers = await scrapeOffersFromUrl(
      "https://www.amazon.com.br/gp/goldbox",
      { ...AMAZON_OPTS, max: 15 },
    );
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
          data: { links: [], html: "" },
        }),
      }),
    );
    await scrapeOffersFromUrl("https://example.com", {
      ...AMAZON_OPTS,
      headers: { Cookie: "ssid=abc" },
    });
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.headers).toEqual({ Cookie: "ssid=abc" });
  });
});
