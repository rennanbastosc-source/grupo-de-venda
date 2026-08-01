import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shopeeScraper } from "@/lib/scrapers/shopee";
import { scrapeOffersFromUrl } from "@/lib/scrapers/firecrawl";

vi.mock("@/lib/scrapers/firecrawl", () => ({
  scrapeOffersFromUrl: vi.fn(),
}));

const mockedScrape = vi.mocked(scrapeOffersFromUrl);

describe("shopeeScraper (profile Firecrawl)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.SCRAPE_MOCK;
    delete process.env.FIRECRAWL_SHOPEE_PROFILE;
    mockedScrape.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("SCRAPE_MOCK=1 retorna fixture sem depender do profile", async () => {
    process.env.SCRAPE_MOCK = "1";
    const offers = await shopeeScraper.fetchOffers();
    expect(offers).toHaveLength(1);
    expect(offers[0].title).toBe("Mock Shopee Oferta");
    expect(mockedScrape).not.toHaveBeenCalled();
  });

  it("sem FIRECRAWL_SHOPEE_PROFILE falha rápido sem chamar o Firecrawl", async () => {
    mockedScrape.mockResolvedValue([]);
    await expect(shopeeScraper.fetchOffers()).rejects.toThrow(
      /FIRECRAWL_SHOPEE_PROFILE/,
    );
    expect(mockedScrape).not.toHaveBeenCalled();
  });

  it("com profile presente, chama o Firecrawl direto com o profile", async () => {
    process.env.FIRECRAWL_SHOPEE_PROFILE = "shopee-logado";
    mockedScrape.mockResolvedValue([
      {
        title: "Oferta Shopee",
        url: "https://shopee.com.br/product/1/2",
        priceCents: 4990,
        externalId: "1-2",
      },
    ]);

    const offers = await shopeeScraper.fetchOffers();
    expect(offers).toHaveLength(1);
    expect(mockedScrape).toHaveBeenCalledTimes(1);
    const [, opts] = mockedScrape.mock.calls[0];
    expect(opts.profile).toBe("shopee-logado");
    expect(opts.hostIncludes).toBe("shopee.com.br");
  });
});
