import { GroupsManager } from "@/components/GroupsManager";
import { SessionPanel } from "@/components/SessionPanel";

export default function GruposPage() {
  return (
    <div className="space-y-6">
      <div className="border-b-[3px] border-ink pb-4">
        <p className="b-label mb-1">Destinos</p>
        <h1 className="text-2xl font-black uppercase tracking-tight text-ink">
          Grupos WhatsApp
        </h1>
        <p className="mt-0.5 text-sm font-medium text-muted">
          Cadastro de grupos autorizados e status da sessão Baileys.
        </p>
      </div>
      <SessionPanel />
      <GroupsManager />
    </div>
  );
}
