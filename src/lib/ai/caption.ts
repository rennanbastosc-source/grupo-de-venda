const DEFAULT_BASE = "http://127.0.0.1:20128/v1";
const DEFAULT_MODEL = "GeMiNi";
const TIMEOUT_MS = 30_000;

function mockCaption(title: string, price: string): string {
  return `🔥 ${title}\n💰 ${price}`;
}

/**
 * Gera legenda WhatsApp curta via 9router (OpenAI-compat).
 * SCRAPE_MOCK=1 → template fixo, sem rede.
 */
export async function generateCaption(input: {
  title: string;
  price: string;
  url: string;
}): Promise<string> {
  if (process.env.SCRAPE_MOCK === "1") {
    return mockCaption(input.title, input.price);
  }

  const base = (process.env.NINE_ROUTER_BASE_URL ?? DEFAULT_BASE).replace(
    /\/$/,
    "",
  );
  const model = process.env.NINE_ROUTER_MODEL ?? DEFAULT_MODEL;
  const apiKey = process.env.NINE_ROUTER_API_KEY;

  const system = [
    "Você escreve legendas curtas de WhatsApp em PT-BR para ofertas.",
    "Máximo ~400 caracteres. Tom de venda, gancho no início.",
    "NÃO invente preço, desconto ou frete — use só o que o usuário passou.",
    "Inclua o link da oferta. Responda só com o texto da legenda, sem aspas nem markdown.",
  ].join(" ");

  const user = [
    `Título: ${input.title}`,
    `Preço: ${input.price}`,
    `URL: ${input.url}`,
  ].join("\n");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers,
      signal: ctrl.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `9router falhou HTTP ${res.status}: ${body.slice(0, 200) || res.statusText}`,
      );
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error("9router retornou legenda vazia");
    }
    return text;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("9router timeout (30s)");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
