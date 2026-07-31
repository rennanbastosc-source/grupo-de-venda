import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { MarketplaceSource, PlatformSession, SessionStatusPublic } from "./types";

export function formatCookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function getServiceSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || url.includes("ci.supabase.co")) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function loadSession(
  source: MarketplaceSource,
  customSupabase?: SupabaseClient,
): Promise<PlatformSession | null> {
  const supabase = customSupabase ?? getServiceSupabase();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("marketplace_sessions")
      .select("source, cookies, status, last_error, updated_at")
      .eq("source", source)
      .maybeSingle();

    if (error || !data) return null;

    const cookies = (data.cookies as Record<string, string>) || {};
    return {
      source,
      cookies,
      cookieHeader: formatCookieHeader(cookies),
      status: (data.status as PlatformSession["status"]) || "unknown",
      lastError: data.last_error ?? undefined,
      updatedAt: data.updated_at ?? undefined,
    };
  } catch {
    return null;
  }
}

export async function saveSession(
  session: PlatformSession,
  customSupabase?: SupabaseClient,
): Promise<void> {
  const supabase = customSupabase ?? getServiceSupabase();
  if (!supabase) return;

  try {
    await supabase.from("marketplace_sessions").upsert({
      source: session.source,
      cookies: session.cookies,
      status: session.status,
      last_error: session.lastError ?? null,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[SessionStore] Falha ao salvar sessão para ${session.source}:`, err);
  }
}

export async function listSessionStatuses(
  customSupabase?: SupabaseClient,
): Promise<SessionStatusPublic[]> {
  const sources: MarketplaceSource[] = ["mercadolivre", "amazon", "shopee"];
  const supabase = customSupabase ?? getServiceSupabase();
  if (!supabase) {
    return sources.map((s) => ({
      source: s,
      status: "unauthenticated",
      lastError: null,
      updatedAt: null,
    }));
  }

  try {
    const { data } = await supabase
      .from("marketplace_sessions")
      .select("source, status, last_error, updated_at");

    const map = new Map((data || []).map((row) => [row.source, row]));
    return sources.map((src) => {
      const found = map.get(src);
      return {
        source: src,
        status: (found?.status as PlatformSession["status"]) || "unauthenticated",
        lastError: found?.last_error ?? null,
        updatedAt: found?.updated_at ?? null,
      };
    });
  } catch {
    return sources.map((s) => ({
      source: s,
      status: "unauthenticated",
      lastError: null,
      updatedAt: null,
    }));
  }
}
