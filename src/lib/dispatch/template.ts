export type MessageVars = {
  title: string;
  price: string;
  affiliate_url: string;
};

export function buildMessage(
  template: string,
  vars: MessageVars,
): string {
  return template
    .replaceAll("{{title}}", vars.title)
    .replaceAll("{{price}}", vars.price)
    .replaceAll("{{affiliate_url}}", vars.affiliate_url);
}

export function formatPriceCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
