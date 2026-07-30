"use client";

import { createClient } from "@/lib/supabase/client";
import { LogOut, User } from "lucide-react";
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
    <header className="flex h-14 items-center justify-between border-b-[3px] border-ink bg-white px-6">
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 border-2 border-ink bg-lime shadow-[2px_2px_0_#0c0c0c]" />
        <h1 className="text-xs font-extrabold uppercase tracking-[0.2em] text-ink">
          Painel admin
        </h1>
      </div>
      <div className="flex items-center gap-3">
        {email ? (
          <span className="hidden items-center gap-1.5 border-2 border-ink bg-ice px-2.5 py-1 text-xs font-bold sm:inline-flex">
            <User className="h-3.5 w-3.5" strokeWidth={2.5} />
            {email}
          </span>
        ) : null}
        <button type="button" onClick={logout} className="b-btn b-btn-ghost !py-1.5 !text-xs">
          <LogOut className="h-3.5 w-3.5" strokeWidth={2.5} />
          Sair
        </button>
      </div>
    </header>
  );
}
