import { afterEach, describe, expect, it, vi } from "vitest";
import { makeSupabase, op, type Op } from "./helpers/fake-supabase";

vi.mock("@/lib/sheets/client", () => ({
  isSheetsConfigured: vi.fn(() => true),
  overwriteRows: vi.fn(async () => {}),
}));

import { isSheetsConfigured, overwriteRows } from "@/lib/sheets/client";
import { mirrorToSheets } from "@/lib/pipeline/run";
import type { PipelineResult } from "@/lib/pipeline/types";

function emptyResult(): PipelineResult {
  return { captioned: 0, affiliates: 0, enqueued: 0, mirrored: 0, errors: [] };
}

function mirrorClient(
  offers: Record<string, unknown>[],
  links: Record<string, unknown>[] = [],
) {
  return makeSupabase((table: string, ops: Op[]) => {
    const sel = String(op(ops, "select")?.args[0] ?? "");
    if (table === "offers" && sel.startsWith("id, status")) {
      return { data: offers, error: null };
    }
    if (table === "affiliate_links") {
      return { data: links, error: null };
    }
    return { data: [], error: null };
  });
}

describe("mirrorToSheets", () => {
  afterEach(() => {
    vi.mocked(overwriteRows).mockClear();
    vi.mocked(isSheetsConfigured).mockReturnValue(true);
  });

  it("reescreve a aba com header + linhas e status enviado/pendente", async () => {
    const result = emptyResult();
    await mirrorToSheets(
      mirrorClient(
        [
          { id: "o1", status: "sent", caption: "Legenda 1", caption_status: "ready" },
          { id: "o2", status: "approved", caption: "Legenda 2", caption_status: "ready" },
        ],
        [{ offer_id: "o1", affiliate_url: "https://meli.la/x" }],
      ),
      result,
    );
    expect(overwriteRows).toHaveBeenCalledOnce();
    const rows = vi.mocked(overwriteRows).mock.calls[0][0];
    expect(rows[0]).toEqual(["id", "link", "caption", "status"]);
    expect(rows[1]).toEqual(["o1", "https://meli.la/x", "Legenda 1", "enviado"]);
    expect(rows[2]).toEqual(["o2", "", "Legenda 2", "pendente"]);
    expect(result.mirrored).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  it("no-op sem Sheets configurado", async () => {
    vi.mocked(isSheetsConfigured).mockReturnValue(false);
    const result = emptyResult();
    await mirrorToSheets(mirrorClient([{ id: "o1", status: "sent" }]), result);
    expect(overwriteRows).not.toHaveBeenCalled();
    expect(result.mirrored).toBe(0);
  });

  it("erro da API vira errors sem lançar", async () => {
    vi.mocked(overwriteRows).mockRejectedValueOnce(new Error("HTTP 500"));
    const result = emptyResult();
    await mirrorToSheets(
      mirrorClient([
        { id: "o1", status: "sent", caption: null, caption_status: "ready" },
      ]),
      result,
    );
    expect(result.mirrored).toBe(0);
    expect(result.errors.join(" ")).toMatch(/mirror: .*HTTP 500/);
  });
});

describe("overwriteRows (ranges reais)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("PUT em A1:D{n} e clear do excedente", async () => {
    vi.resetModules();
    vi.doUnmock("@/lib/sheets/client");
    vi.stubEnv("SCRAPE_MOCK", "");
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL", "a@b.com");
    vi.stubEnv("GOOGLE_SHEETS_SPREADSHEET_ID", "sheet-1");
    // chave RSA de teste não é necessária: stub do getAccessToken via fetch
    // exigiria assinar JWT — em vez disso, stub de createSign é overkill;
    // validamos os ranges interceptando fetch e injetando token fake.
    const { generateKeyPairSync } = await import("node:crypto");
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", privateKey as string);

    const calls: { url: string; method?: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, method: init?.method });
        if (url.startsWith("https://oauth2.googleapis.com/token")) {
          return new Response(JSON.stringify({ access_token: "tok" }), {
            status: 200,
          });
        }
        return new Response("{}", { status: 200 });
      }),
    );

    const { overwriteRows: real } = await import("@/lib/sheets/client");
    await real([
      ["id", "link", "caption", "status"],
      ["o1", "l", "c", "enviado"],
    ]);

    const put = calls.find((c) => c.method === "PUT");
    expect(put?.url).toContain(encodeURIComponent("Ofertas!A1:D2"));
    const clear = calls.find((c) => c.url.includes(":clear"));
    expect(clear?.url).toContain(encodeURIComponent("Ofertas!A3:D"));
  });
});
