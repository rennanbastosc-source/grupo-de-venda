import { createSign, createPrivateKey } from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const DEFAULT_RANGE = "Ofertas!A:L";

/** Header row 1 (documentação): id | title | price | url | source | status | caption | caption_status | affiliate_url | sheets_synced_at | updated_at | notes */

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

/** POST values:append. Retorna 1ª linha 1-indexed gravada (null se vazio). */
export async function appendRows(
  rows: string[][],
): Promise<{ startRow: number | null }> {
  if (!rows.length) return { startRow: null };
  const { sheetId, range } = assertConfigured();
  const token = await getAccessToken();
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}` +
    `/values/${encodeURIComponent(range)}:append` +
    `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: rows }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Sheets append falhou HTTP ${res.status}: ${body.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as {
    updates?: { updatedRange?: string };
  };
  const updated = data.updates?.updatedRange ?? "";
  // e.g. Ofertas!A12:L14
  const m = updated.match(/![A-Z]+(\d+)/);
  return { startRow: m ? Number(m[1]) : null };
}

/** PUT values update — startRow 1-indexed (linha da planilha). */
export async function updateRows(
  startRow: number,
  rows: string[][],
): Promise<void> {
  if (!rows.length) return;
  if (startRow < 1) throw new Error("startRow deve ser >= 1");

  const { sheetId, range } = assertConfigured();
  const token = await getAccessToken();
  const sheet = sheetNameFromRange(range);
  const endRow = startRow + rows.length - 1;
  const updateRange = `${sheet}!A${startRow}:L${endRow}`;

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}` +
    `/values/${encodeURIComponent(updateRange)}` +
    `?valueInputOption=USER_ENTERED`;

  const res = await fetch(url, {
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
}

/** GET values */
export async function readRows(): Promise<string[][]> {
  const { sheetId, range } = assertConfigured();
  const token = await getAccessToken();
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}` +
    `/values/${encodeURIComponent(range)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Sheets read falhou HTTP ${res.status}: ${body.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as { values?: string[][] };
  return data.values ?? [];
}
