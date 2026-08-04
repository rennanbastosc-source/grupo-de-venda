export type MessageVars = {
  title: string;
  price: string;
  affiliate_url: string;
  caption?: string;
  coupon?: string;
  coupon_line?: string;
  price_line?: string;
};

export function buildMessage(
  template: string,
  vars: MessageVars,
): string {
  const replaced = template.replace(
    /\{\{(title|price|affiliate_url|caption|coupon|coupon_line|price_line)\}\}/g,
    (_, k: keyof MessageVars) => {
      if (k === "caption") {
        return vars.caption?.trim() ?? "";
      }
      return vars[k] ?? "";
    },
  );

  return replaced
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line, i, arr) => line.trim() !== "" || (i > 0 && arr[i - 1].trim() !== ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatPriceCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatPriceLine(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function couponLine(code?: string | null): string {
  return code?.trim() ? `🏷️ Cupom: ${code.trim()}` : "";
}
