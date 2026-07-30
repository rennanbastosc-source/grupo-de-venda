import { describe, expect, it } from "vitest";
import { isProductOffer } from "@/lib/scrapers/product-filter";

describe("product-filter (Fatia 02)", () => {
  it("aceita oferta de produto válida do Mercado Livre", () => {
    expect(
      isProductOffer("mercadolivre", {
        title: "Smartphone Samsung Galaxy A36",
        url: "https://www.mercadolivre.com.br/smartphone-samsung/p/MLB47115842",
      }),
    ).toBe(true);

    expect(
      isProductOffer("mercadolivre", {
        title: "Fone de Ouvido",
        url: "https://www.mercadolivre.com.br/up/MLBU123456",
      }),
    ).toBe(true);
  });

  it("rejeita links institucionais / menu do Mercado Livre", () => {
    expect(
      isProductOffer("mercadolivre", {
        title: "Já tenho conta",
        url: "https://www.mercadolivre.com.br/gz/account-verification",
      }),
    ).toBe(false);

    expect(
      isProductOffer("mercadolivre", {
        title: "Sou novo",
        url: "https://www.mercadolivre.com.br/registration",
      }),
    ).toBe(false);

    expect(
      isProductOffer("mercadolivre", {
        title: "Central de privacidade.",
        url: "https://www.mercadolivre.com.br/privacidade",
      }),
    ).toBe(false);
  });

  it("aceita oferta de produto válida da Amazon com /dp/ASIN", () => {
    expect(
      isProductOffer("amazon", {
        title: "Mouse Gamer Logitech G203",
        url: "https://www.amazon.com.br/dp/B0876MJBG6",
      }),
    ).toBe(true);
  });

  it("rejeita banners de cupons genéricos da Amazon", () => {
    expect(
      isProductOffer("amazon", {
        title: "15% off em Ferramentas",
        url: "https://www.amazon.com.br/b?node=16215715011",
      }),
    ).toBe(false);

    expect(
      isProductOffer("amazon", {
        title: "20% off em Esportes",
        url: "https://www.amazon.com.br/b?node=16215716011",
      }),
    ).toBe(false);
  });

  it("rejeita ofertas com título ou url vazios", () => {
    expect(isProductOffer("mercadolivre", { title: "", url: "https://x.com" })).toBe(false);
    expect(isProductOffer("mercadolivre", { title: "Item", url: "" })).toBe(false);
  });
});
