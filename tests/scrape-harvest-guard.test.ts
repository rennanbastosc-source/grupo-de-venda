import { describe, expect, it, vi } from "vitest";
import { harvestOffers } from "@/lib/scrapers/html-extract";
import { isProductOffer } from "@/lib/scrapers/product-filter";
import { runScrape, type OfferStore } from "@/lib/scrapers/run-pipeline";

// Padrões copiados de mercadolivre.ts — se lá mudar, este teste trava a regressão.
const ML = {
  hostIncludes: "mercadolivre.com.br",
  hrefPattern: /\/p\/MLB|\/up\/MLB|MLB\d+/i,
};

// Amostra real colhida de mercadolivre.com.br/ofertas (2026-07-31).
const ML_LINKS_REAIS = [
  "https://www.mercadolivre.com.br/creatina-monohidratada-pura-1kg-dark-lab-unidade-sem-sabor/p/MLB25929487?pdp_filters=x",
  "https://www.mercadolivre.com.br/bicicleta-spinning-com-roda-de-inercia-de-13kg-wct-fitness-cor-preto/p/MLB3421",
  "https://www.mercadolivre.com.br/fone-de-ouvido/up/MLBU123456",
];

// Lixo que hoje está gravado em `offers` (colhido antes do filtro existir).
// O harvest atual precisa barrá-lo já no hrefPattern, antes do isProductOffer.
const ML_LIXO = [
  "https://www.mercadolivre.com.br/registration?confirmation_url=https%3A%2F%2Flista.mercadolivre.com.br%2Fofertas&registrationType=negative_traffic",
  "https://www.mercadolivre.com/jms/mlb/lgz/login?platform_id=ml&go=https%3A%2F%2Flista.mercadolivre.com.br%2Fofertas",
  "https://www.mercadolivre.com.br/privacidade#tech-and-cookies",
  "https://www.mercadolivre.com.br/ajuda",
  "https://www.mercadolivre.com.br/ofertas",
  "https://developers.mercadolivre.com.br/",
];

function makeStore(): OfferStore & { finished: unknown[] } {
  const finished: unknown[] = [];
  return {
    finished,
    startRun: async () => "run-1",
    finishRun: async (_id, r) => {
      finished.push(r);
    },
    upsertOffer: async () => "inserted",
  };
}

describe("blindagem do Mercado Livre", () => {
  it("colhe os formatos de link que a página real serve hoje", () => {
    const offers = harvestOffers(
      "https://www.mercadolivre.com.br/ofertas",
      [...ML_LINKS_REAIS, ...ML_LIXO],
      undefined,
      ML,
    );
    expect(offers).toHaveLength(ML_LINKS_REAIS.length);
    for (const o of offers) {
      expect(isProductOffer("mercadolivre", o)).toBe(true);
    }
  });

  it("descarta navegação e subdomínio de devs", () => {
    const offers = harvestOffers(
      "https://www.mercadolivre.com.br/ofertas",
      ML_LIXO,
      undefined,
      ML,
    );
    expect(offers).toHaveLength(0);
  });
});

describe("pipeline sinaliza colheita vazia", () => {
  it("marca o run como falho quando nada é colhido", async () => {
    vi.resetModules();
    vi.doMock("@/lib/scrapers/registry", () => ({
      listActiveScrapeSources: () => ["shopee"],
      getScraper: () => ({ source: "shopee", fetchOffers: async () => [] }),
    }));
    const { runScrape: run } = await import("@/lib/scrapers/run-pipeline");
    const store = makeStore();

    const res = await run(store, "shopee");

    expect(res.upserted).toBe(0);
    expect(res.errors[0]).toMatch(/nenhum link de produto colhido/i);
    expect(store.finished[0]).toMatchObject({ ok: false });
    vi.doUnmock("@/lib/scrapers/registry");
  });

  it("distingue 'colheu mas filtrou tudo' de 'não colheu nada'", async () => {
    vi.resetModules();
    vi.doMock("@/lib/scrapers/registry", () => ({
      listActiveScrapeSources: () => ["amazon"],
      getScraper: () => ({
        source: "amazon",
        fetchOffers: async () => [
          { title: "Minha conta", url: "https://www.amazon.com.br/gp/css" },
        ],
      }),
    }));
    const { runScrape: run } = await import("@/lib/scrapers/run-pipeline");
    const store = makeStore();

    const res = await run(store, "amazon");

    expect(res.errors[0]).toMatch(/descartados pelo filtro/i);
    expect(store.finished[0]).toMatchObject({ ok: false });
    vi.doUnmock("@/lib/scrapers/registry");
  });

  it("runScrape segue exportado com o contrato original", () => {
    expect(typeof runScrape).toBe("function");
  });
});
