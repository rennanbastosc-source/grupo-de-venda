export type MessageVars = {
  title: string;
  price: string;
  affiliate_url: string;
  caption?: string;
};

export function buildMessage(
  template: string,
  vars: MessageVars,
): string {
  return template.replace(
    /\{\{(title|price|affiliate_url|caption)\}\}/g,
    (_, k: keyof MessageVars) => {
      if (k === "caption") {
        const c = vars.caption?.trim();
        return c || vars.title || "";
      }
      return vars[k] ?? "";
    },
  );
}

export function formatPriceCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
