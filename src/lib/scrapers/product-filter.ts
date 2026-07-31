import type { RawOffer, ScrapeSource } from "./types";

const REJECT_TITLES = [
  "já tenho conta",
  "sou novo",
  "central de privacidade",
  "termos de uso",
  "minha conta",
  "carrinho de compras",
  "carrinho",
  "ajuda",
];

export function isProductOffer(
  source: ScrapeSource,
  raw: RawOffer,
): boolean {
  const title = (raw.title || "").trim().toLowerCase();
  const url = (raw.url || "").trim();

  if (!title || !url) return false;

  // Rejeita links de suporte / navegação
  if (REJECT_TITLES.some((t) => title.includes(t))) {
    return false;
  }

  // Rejeita banners de cupons genéricos da Amazon tipo "15% off em Ferramentas"
  if (/^\d+%\s*off/i.test(title) && !url.includes("/dp/")) {
    return false;
  }

  switch (source) {
    case "mercadolivre":
      return (
        url.includes("/p/MLB") ||
        url.includes("/up/MLB") ||
        /MLB\d+/i.test(url) ||
        (url.includes("mercadolivre.com.br") && (url.includes("/p/") || url.includes("/up/")))
      );

    case "amazon":
      return (
        /\/dp\/[A-Z0-9]{10}/i.test(url) ||
        url.includes("/gp/product/") ||
        (url.includes("amazon.com.br") && url.includes("/dp/"))
      );

    case "shopee":
      return (
        /i\.\d+\.\d+/i.test(url) ||
        /\/product\/\d+\/\d+/i.test(url) ||
        (url.includes("shopee.com.br") &&
          !url.endsWith("/flash_sale") &&
          !url.endsWith("/cart") &&
          !url.includes("/user/") &&
          !url.includes("/help"))
      );

    default:
      return true;
  }
}
