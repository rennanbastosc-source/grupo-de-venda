/** Normaliza telefone BR/E.164 para dígitos (ex: 5511999999999).
 * Cópia local do app `src/lib/wa/phone` — worker package separado (rootDir). */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  let n = digits;
  if (n.length === 10 || n.length === 11) n = `55${n}`;
  if (n.length < 12 || n.length > 15) return null;
  return n;
}
