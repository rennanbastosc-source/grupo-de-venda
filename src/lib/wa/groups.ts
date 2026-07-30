import type { WaGroupInput } from "./types";

const JID_RE = /^[\w.-]+@(g\.us|s\.whatsapp\.net)$/i;

export function normalizeJid(jid: string): string {
  return jid.trim().toLowerCase();
}

export function validateGroupInput(input: {
  jid?: unknown;
  name?: unknown;
  active?: unknown;
  daily_limit?: unknown;
  notes?: unknown;
}): { ok: true; value: WaGroupInput } | { ok: false; error: string } {
  if (typeof input.jid !== "string" || !input.jid.trim()) {
    return { ok: false, error: "jid obrigatório" };
  }
  const jid = normalizeJid(input.jid);
  if (!JID_RE.test(jid)) {
    return { ok: false, error: "jid inválido (ex: 120363...@g.us)" };
  }
  if (typeof input.name !== "string" || !input.name.trim()) {
    return { ok: false, error: "name obrigatório" };
  }
  let daily_limit: number | null | undefined = undefined;
  if (input.daily_limit !== undefined && input.daily_limit !== null) {
    const n = Number(input.daily_limit);
    if (!Number.isInteger(n) || n < 1) {
      return { ok: false, error: "daily_limit deve ser inteiro >= 1" };
    }
    daily_limit = n;
  } else if (input.daily_limit === null) {
    daily_limit = null;
  }

  return {
    ok: true,
    value: {
      jid,
      name: input.name.trim(),
      active: input.active === undefined ? true : Boolean(input.active),
      daily_limit,
      notes:
        input.notes === undefined || input.notes === null
          ? null
          : String(input.notes),
    },
  };
}

export function assertJidUnique(
  jid: string,
  existingJids: string[],
  excludeId?: string,
  rows?: { id: string; jid: string }[],
): string | null {
  const n = normalizeJid(jid);
  if (rows) {
    const hit = rows.find(
      (r) => normalizeJid(r.jid) === n && r.id !== excludeId,
    );
    return hit ? "jid já cadastrado" : null;
  }
  if (existingJids.map(normalizeJid).includes(n)) return "jid já cadastrado";
  return null;
}
