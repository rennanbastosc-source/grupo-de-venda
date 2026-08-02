import type { WaGroupInput } from "./types";

const JID_RE = /^[\w.-]+@(g\.us|s\.whatsapp\.net)$/i;

/** Teto de grupos ativos por número de WhatsApp (grupos espelhados). */
export const MAX_ACTIVE_GROUPS = 15;

/** Mensagem de erro se ativar mais um grupo estourar o teto; null se cabe. */
export function activeLimitError(activeCount: number): string | null {
  return activeCount >= MAX_ACTIVE_GROUPS
    ? `Limite de ${MAX_ACTIVE_GROUPS} grupos ativos atingido`
    : null;
}

export function normalizeJid(jid: string): string {
  return jid.trim().toLowerCase();
}

export function validateGroupInput(input: {
  jid?: unknown;
  name?: unknown;
  active?: unknown;
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

  return {
    ok: true,
    value: {
      jid,
      name: input.name.trim(),
      active: input.active === undefined ? true : Boolean(input.active),
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
