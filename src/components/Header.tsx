"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function Header({ email }: { email?: string | null }) {
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
      <h1 className="text-sm font-medium text-slate-600">Painel admin</h1>
      <div className="flex items-center gap-3">
        {email ? (
          <span className="text-sm text-slate-600">{email}</span>
        ) : null}
        <button
          type="button"
          onClick={logout}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Sair
        </button>
      </div>
    </header>
  );
}
