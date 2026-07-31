import type { MarketplaceSource, PlatformSession } from "./types";
import { loadSession, saveSession } from "./store";
import { performLogin } from "./login";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensureSession(
  source: MarketplaceSource,
  opts?: { customSupabase?: SupabaseClient; forceLogin?: boolean },
): Promise<PlatformSession> {
  if (!opts?.forceLogin) {
    const existing = await loadSession(source, opts?.customSupabase);
    if (
      existing &&
      existing.status === "ok" &&
      Object.keys(existing.cookies).length > 0
    ) {
      return existing;
    }
  }

  try {
    const newSession = await performLogin(source);
    await saveSession(newSession, opts?.customSupabase);
    return newSession;
  } catch (err) {
    const lastError = err instanceof Error ? err.message : String(err);
    const errorSession: PlatformSession = {
      source,
      cookies: {},
      cookieHeader: "",
      status: "error",
      lastError,
      updatedAt: new Date().toISOString(),
    };
    await saveSession(errorSession, opts?.customSupabase);
    throw err;
  }
}

export async function withSessionRetry<T>(
  source: MarketplaceSource,
  fn: (session: PlatformSession) => Promise<T>,
  opts?: { customSupabase?: SupabaseClient },
): Promise<T> {
  const session = await ensureSession(source, opts);
  try {
    return await fn(session);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isAuthError =
      msg.includes("401") ||
      msg.includes("403") ||
      msg.includes("Login Necessário") ||
      msg.includes("login") ||
      msg.includes("sessão inválida");

    if (!isAuthError) throw err;

    // Retry 1x com forceLogin
    const freshSession = await ensureSession(source, {
      ...opts,
      forceLogin: true,
    });
    return await fn(freshSession);
  }
}
