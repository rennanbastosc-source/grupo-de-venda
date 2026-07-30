"use client";

import { createClient } from "@/lib/supabase/client";
import { Zap } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (err) {
        setError(err.message);
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Falha ao autenticar. Verifique as variáveis Supabase.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-sm space-y-4 border-[3px] border-ink bg-white p-6 shadow-brutal"
    >
      <div className="flex items-start gap-3 border-b-[3px] border-ink pb-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-ink bg-lime shadow-brutal-sm">
          <Zap className="h-5 w-5 text-ink" strokeWidth={2.5} />
        </span>
        <div>
          <h1 className="text-lg font-black uppercase tracking-tight text-ink">
            Entrar
          </h1>
          <p className="text-xs font-bold uppercase tracking-widest text-muted">
            Admin · single-tenant
          </p>
        </div>
      </div>
      <label className="block text-sm">
        <span className="b-label">E-mail</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="b-input"
        />
      </label>
      <label className="block text-sm">
        <span className="b-label">Senha</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="b-input"
        />
      </label>
      {error ? (
        <p className="b-alert b-alert-danger" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={loading} className="b-btn w-full">
        {loading ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ice p-4">
      <Suspense
        fallback={
          <p className="text-sm font-bold uppercase tracking-wide text-muted">
            Carregando…
          </p>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
