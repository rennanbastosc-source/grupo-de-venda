"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav: { href: string; label: string; exact?: boolean }[] = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/grupos", label: "Grupos" },
  { href: "/dashboard/ofertas", label: "Ofertas" },
  { href: "/dashboard/links", label: "Links" },
  { href: "/dashboard/disparos", label: "Disparos" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-5">
        <p className="text-sm font-semibold tracking-tight text-slate-900">
          Grupo de Venda
        </p>
        <p className="text-xs text-slate-500">Promoções · WhatsApp</p>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-2" aria-label="Principal">
        {nav.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm ${
                active
                  ? "bg-slate-900 font-medium text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
