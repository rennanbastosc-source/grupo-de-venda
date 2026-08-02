/**
 * Auth state Baileys em Supabase (`wa_session_keys`), cifrado.
 * Fallback: multi-file em BAILEYS_AUTH_DIR se sem WHATSAPP_SESSION_KEY.
 */
import path from "node:path";
import { rest } from "../db.js";
import { encryptSession, decryptSession } from "./crypto.js";

const CREDS_ID = "creds";
const LOTE = 200;

export type BaileysAuthDeps = {
  initAuthCreds: () => AuthenticationCredsLike;
  BufferJSON: {
    replacer: (k: string, v: unknown) => unknown;
    reviver: (k: string, v: unknown) => unknown;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  proto: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useMultiFileAuthState: (dir: string) => Promise<any>;
};

// Creds shape mínima (Baileys)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuthenticationCredsLike = any;

export type AuthBundle = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: { creds: AuthenticationCredsLike; keys: any };
  saveCreds: () => Promise<void>;
  clearAuth: () => Promise<void>;
};

export async function createAuthState(
  deps: BaileysAuthDeps,
  encryptionKey: string | null,
): Promise<AuthBundle> {
  if (!encryptionKey) {
    const dir =
      process.env.BAILEYS_AUTH_DIR ||
      path.join(process.cwd(), "data", "auth");
    const multi = await deps.useMultiFileAuthState(dir);
    return {
      state: multi.state,
      saveCreds: multi.saveCreds,
      clearAuth: async () => {
        // multi-file: best-effort — caller may rm dir; leave no-op if fs hard
        const { rm } = await import("node:fs/promises");
        await rm(dir, { recursive: true, force: true }).catch(() => {});
      },
    };
  }

  const encode = (value: unknown) =>
    encryptSession(
      JSON.stringify(value, deps.BufferJSON.replacer),
      encryptionKey,
    );
  const decode = (value: string): unknown =>
    JSON.parse(
      decryptSession(value, encryptionKey),
      deps.BufferJSON.reviver,
    );

  const rowId = (type: string, id: string) => `${type}:${id}`;

  // Nunca engolir erro de load com initAuthCreds: saveCreds seguinte
  // sobrescreve sessão pareada (sintoma: "conta some após deploy").
  const rows = (await rest(
    "GET",
    `wa_session_keys?id=eq.${encodeURIComponent(CREDS_ID)}&select=value`,
    undefined,
    { Prefer: "return=representation" },
  )) as { value: string }[] | null;
  let creds: AuthenticationCredsLike;
  if (rows?.[0]?.value) {
    try {
      creds = decode(rows[0].value) as AuthenticationCredsLike;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Creds WA ilegíveis (WHATSAPP_SESSION_KEY errada ou payload corrompido). Não sobrescrevendo. ${msg}`,
      );
    }
  } else {
    creds = deps.initAuthCreds();
  }

  const state = {
    creds,
    keys: {
      get: async (type: string, ids: string[]) => {
        if (ids.length === 0) return {};
        // PostgREST: quote ids com ":" 
        const inList = ids
          .map((id) => `"${rowId(type, id).replace(/"/g, "")}"`)
          .join(",");
        const rows = (await rest(
          "GET",
          `wa_session_keys?id=in.(${inList})&select=id,value`,
          undefined,
          { Prefer: "return=representation" },
        )) as { id: string; value: string }[] | null;
        const found: Record<string, unknown> = {};
        const prefix = type.length + 1;
        for (const row of rows ?? []) {
          const value = decode(row.value);
          found[row.id.slice(prefix)] =
            type === "app-state-sync-key" && value
              ? deps.proto.Message.AppStateSyncKeyData.fromObject(
                  value as Record<string, unknown>,
                )
              : value;
        }
        return found;
      },
      set: async (data: Record<string, Record<string, unknown> | null>) => {
        const upserts: { id: string; value: string; updated_at: string }[] =
          [];
        const removals: string[] = [];
        for (const [type, entries] of Object.entries(data)) {
          if (!entries) continue;
          for (const [id, value] of Object.entries(entries)) {
            const key = rowId(type, id);
            if (value) {
              upserts.push({
                id: key,
                value: encode(value),
                updated_at: new Date().toISOString(),
              });
            } else removals.push(key);
          }
        }
        for (let i = 0; i < upserts.length; i += LOTE) {
          const lote = upserts.slice(i, i + LOTE);
          await rest("POST", "wa_session_keys?on_conflict=id", lote, {
            Prefer: "resolution=merge-duplicates,return=minimal",
          });
        }
        if (removals.length > 0) {
          const inList = removals.map(encodeURIComponent).join(",");
          await rest("DELETE", `wa_session_keys?id=in.(${inList})`);
        }
      },
    },
  };

  return {
    state,
    saveCreds: async () => {
      await rest(
        "POST",
        "wa_session_keys?on_conflict=id",
        [
          {
            id: CREDS_ID,
            value: encode(creds),
            updated_at: new Date().toISOString(),
          },
        ],
        { Prefer: "resolution=merge-duplicates,return=minimal" },
      );
    },
    clearAuth: async () => {
      await rest("DELETE", "wa_session_keys?id=not.is.null");
    },
  };
}
