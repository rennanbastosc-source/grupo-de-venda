export type MessageVars = {
  title: string;
  price: string;
  affiliate_url: string;
};

export function buildMessage(
  template: string,
  vars: MessageVars,
): string {
  return template.replace(/\{\{(title|price|affiliate_url)\}\}/g, (_, k) => vars[k as keyof MessageVars] ?? "");
}

export function formatPriceCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
