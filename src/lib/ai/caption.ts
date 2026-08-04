const DEFAULT_BASE = "http://127.0.0.1:20128/v1";
const DEFAULT_MODEL = "GeMiNi";
const TIMEOUT_MS = 30_000;

function mockCaption(title: string, price: string): string {
  const words = title.split(" ").filter(Boolean);
  const mainWord = words[0]?.toUpperCase() ?? "DISSO";
  return `QUANDO PRECISAR DE ${mainWord} VC VAI LEMBRAR DO URUBU`;
}

/**
 * O prompt proíbe URLs, mas prompt é pedido, não garantia: o modelo já mandou
 * link cru (sem afiliado) no meio da legenda, e a mensagem saiu com dois links.
 * Corta a URL e a isca que a precede ("Corre:", "Garanta o seu agora:").
 */
export function stripUrls(text: string): string {
  return text
    .replace(/[^\s]*:\s*https?:\/\/\S+/gi, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .trim();
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
    "Você é o Urubu das Promoções, copywriter de achados com humor cotidiano e direto.",
    "Escreva APENAS UM GANCHO CURTO (1 linha, máximo ~70 caracteres).",
    "Estilo: MAIÚSCULAS (ALL CAPS ou maioria em caps), tom bem-humorado de dor/desejo cotidiano, sem ser vendedor chato.",
    "Pode fazer referência sutil à categoria do produto vinda do título.",
    "PROIBIDO: NÃO mencione preço, NÃO mencione valor em R$, NÃO coloque nome completo/especificações do produto, NÃO inclua URLs/links e NÃO invente cupons.",
    "Responda só com o texto do gancho, sem aspas, sem markdown.",
  ].join(" ");

  const user = [
    `Título: ${input.title}`,
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
        temperature: 0.85,
        // provider novo do 9router streama por default — chunks concatenados
        // quebram res.json(); pedimos resposta única explicitamente
        stream: false,
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
    const text = stripUrls(data.choices?.[0]?.message?.content ?? "");
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
