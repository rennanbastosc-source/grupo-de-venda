import { describe, expect, it } from "vitest";

import { stripUrls } from "@/lib/ai/caption";

describe("stripUrls", () => {
  it("remove a URL e a isca que a apresenta", () => {
    // caso real: a mensagem saiu com dois links, o da caption sem afiliado
    const bruto =
      "🔥 Samsung Galaxy A36 5G por R$1.279!\nDesempenho que você merece!\nCorre: https://www.mercadolivre.com.br/smartphone-galaxy/p/MLB47115842?pdp_filters=deal#polycard";
    const limpo = stripUrls(bruto);

    expect(limpo).not.toContain("http");
    expect(limpo).not.toContain("Corre:");
    expect(limpo).toContain("Samsung Galaxy A36 5G por R$1.279!");
  });

  it("remove URL solta no meio do texto", () => {
    expect(stripUrls("Olha https://x.com/y que achado")).toBe(
      "Olha que achado",
    );
  });

  it("não mexe em legenda sem link", () => {
    const ok = "Para tudo! 😱 Achei o kit de potes que veda melhor que segredo.";
    expect(stripUrls(ok)).toBe(ok);
  });

  it("preserva preço e pontuação", () => {
    expect(stripUrls("Fone por R$ 99,90! Garanta: http://a.b/c")).toBe(
      "Fone por R$ 99,90!",
    );
  });
});
