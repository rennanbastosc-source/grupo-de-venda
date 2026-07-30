"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  LayoutDashboard,
  Link2,
  Megaphone,
  Send,
  Tag,
  Users,
  Zap,
} from "lucide-react";

const nav: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/bot", label: "Bot", icon: Bot },
  { href: "/dashboard/grupos", label: "Grupos", icon: Users },
  { href: "/dashboard/ofertas", label: "Ofertas", icon: Tag },
  { href: "/dashboard/links", label: "Links", icon: Link2 },
  { href: "/dashboard/disparos", label: "Disparos", icon: Send },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r-[3px] border-ink bg-purple text-white">
      <div className="border-b-[3px] border-ink bg-lime px-4 py-5 text-ink">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center border-2 border-ink bg-purple text-white shadow-[2px_2px_0_#0c0c0c]">
            <Zap className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <div>
            <p className="text-sm font-extrabold tracking-tight uppercase">
              Grupo de Venda
            </p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink/70">
              Promo · WA
            </p>
          </div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Principal">
        {nav.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-2.5 border-2 px-3 py-2.5 text-sm font-bold uppercase tracking-wide transition-all ${
                active
                  ? "border-ink bg-lime text-ink shadow-[3px_3px_0_#0c0c0c]"
                  : "border-transparent text-white/90 hover:border-ink hover:bg-purple-deep"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${active ? "text-ink" : "text-lime"}`}
                strokeWidth={2.5}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t-[3px] border-ink bg-purple-deep p-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-lime">
          Single-tenant · ops
        </p>
      </div>
    </aside>
  );
}
