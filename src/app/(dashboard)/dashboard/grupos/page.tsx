import { GroupsManager } from "@/components/GroupsManager";
import Link from "next/link";

export default function GruposPage() {
  return (
    <div className="space-y-6">
      <div className="border-b-[3px] border-ink pb-4">
        <p className="b-label mb-1">Destinos</p>
        <h1 className="text-2xl font-black uppercase tracking-tight text-ink">
          Grupos WhatsApp
        </h1>
        <p className="mt-0.5 text-sm font-medium text-muted">
          Cadastro de grupos autorizados. Sessão e pareamento ficam em{" "}
          <Link
            href="/dashboard/bot"
            className="font-extrabold text-ink underline decoration-2 underline-offset-2"
          >
            Bot
          </Link>
          .
        </p>
      </div>
      <GroupsManager />
    </div>
  );
}
