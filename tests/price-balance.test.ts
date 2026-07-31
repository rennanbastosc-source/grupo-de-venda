import { describe, expect, it } from "vitest";

export function calculateDiscount(priceCents: number | null, originalPriceCents: number | null) {
  if (!priceCents || !originalPriceCents || originalPriceCents <= priceCents) {
    return { discountPercent: 0, savingsCents: 0 };
  }
  const savingsCents = originalPriceCents - priceCents;
  const discountPercent = Math.round((savingsCents / originalPriceCents) * 100);
  return { discountPercent, savingsCents };
}

describe("calculateDiscount", () => {
  it("calcula desconto percentual e valor economizado corretamente", () => {
    const { discountPercent, savingsCents } = calculateDiscount(3400, 6899);
    expect(discountPercent).toBe(51);
    expect(savingsCents).toBe(3499);
  });

  it("retorna zero para preços ausentes ou invalidos", () => {
    expect(calculateDiscount(null, 5000)).toEqual({ discountPercent: 0, savingsCents: 0 });
    expect(calculateDiscount(5000, 5000)).toEqual({ discountPercent: 0, savingsCents: 0 });
    expect(calculateDiscount(6000, 5000)).toEqual({ discountPercent: 0, savingsCents: 0 });
  });
});
