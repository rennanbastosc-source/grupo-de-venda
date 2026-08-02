import { createSign, createPrivateKey } from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const DEFAULT_RANGE = "Ofertas!A:D";

/** Header row 1 (documentação): id | link | caption | status (enviado/pendente) */

function envEmail(): string | undefined {
  return process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() || undefined;
}

function envKey(): string | undefined {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!raw?.trim()) return undefined;
  return raw.replace(/\\n/g, "\n");
}

function envSheetId(): string | undefined {
  return process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() || undefined;
}

function envRange(): string {
  return process.env.GOOGLE_SHEETS_RANGE?.trim() || DEFAULT_RANGE;
}

export function isSheetsConfigured(): boolean {
  if (process.env.SCRAPE_MOCK === "1") return false;
  return Boolean(envEmail() && envKey() && envSheetId());
}

function assertConfigured(): {
  email: string;
  key: string;
  sheetId: string;
  range: string;
} {
  if (process.env.SCRAPE_MOCK === "1" || !isSheetsConfigured()) {
    throw new Error("Sheets não configurado");
  }
  return {
    email: envEmail()!,
    key: envKey()!,
    sheetId: envSheetId()!,
    range: envRange(),
  };
}

function b64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/** JWT RS256 + exchange por access_token. */
export async function getAccessToken(): Promise<string> {
  const { email, key } = assertConfigured();

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claim}`;

  const sign = createSign("RSA-SHA256");
  sign.update(unsigned);
  sign.end();
  const sig = b64url(
    sign.sign(createPrivateKey({ key, format: "pem" })),
  );
  const jwt = `${unsigned}.${sig}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Sheets token falhou HTTP ${res.status}: ${body.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Sheets token sem access_token");
  }
  return data.access_token;
}

function sheetNameFromRange(range: string): string {
  const i = range.indexOf("!");
  return i >= 0 ? range.slice(0, i) : range;
}

/**
 * Espelho de mão única: reescreve a aba inteira a partir de A1 (header +
 * linhas) e limpa o excedente de execuções anteriores. Idempotente, sem
 * estado de linha no banco.
 */
export async function overwriteRows(rows: string[][]): Promise<void> {
  if (!rows.length) return;
  const { sheetId, range } = assertConfigured();
  const token = await getAccessToken();
  const sheet = sheetNameFromRange(range);
  const updateRange = `${sheet}!A1:D${rows.length}`;

  const putUrl =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}` +
    `/values/${encodeURIComponent(updateRange)}` +
    `?valueInputOption=USER_ENTERED`;

  const res = await fetch(putUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: rows }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Sheets update falhou HTTP ${res.status}: ${body.slice(0, 200)}`,
    );
  }

  const clearRange = `${sheet}!A${rows.length + 1}:D`;
  const clearUrl =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}` +
    `/values/${encodeURIComponent(clearRange)}:clear`;

  const clearRes = await fetch(clearUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });

  if (!clearRes.ok) {
    const body = await clearRes.text().catch(() => "");
    throw new Error(
      `Sheets clear falhou HTTP ${clearRes.status}: ${body.slice(0, 200)}`,
    );
  }
}
