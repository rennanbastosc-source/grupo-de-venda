/**
 * Acesso PostgREST do worker (service role). Extraído de baileys/auth-state.ts
 * para reuso: auth cifrada, dedupe durável de envio e eventos de conexão.
 */

function supabaseConfig() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return { url: url.replace(/\/$/, ""), key };
}

export function hasSupabaseEnv(): boolean {
  const { url, key } = supabaseConfig();
  return Boolean(url && key);
}

export async function rest(
  method: string,
  pathAndQuery: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
) {
  const { url, key } = supabaseConfig();
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes");
  const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Supabase REST ${res.status}: ${t}`);
  }
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** true se o job já foi entregue (registro durável em wa_sent_jobs). */
export async function isJobSent(jobId: string): Promise<boolean> {
  const rows = (await rest(
    "GET",
    `wa_sent_jobs?job_id=eq.${encodeURIComponent(jobId)}&select=job_id`,
    undefined,
    { Prefer: "return=representation" },
  )) as { job_id: string }[] | null;
  return Boolean(rows?.length);
}

/** Registra entrega do job. Idempotente (merge-duplicates). */
export async function markJobSent(jobId: string): Promise<void> {
  await rest(
    "POST",
    "wa_sent_jobs?on_conflict=job_id",
    [{ job_id: jobId, sent_at: new Date().toISOString() }],
    { Prefer: "resolution=merge-duplicates,return=minimal" },
  );
}
