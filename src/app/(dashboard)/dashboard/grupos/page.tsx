import { GroupsManager } from "@/components/GroupsManager";
import { SessionPanel } from "@/components/SessionPanel";

export default function GruposPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Grupos WhatsApp</h1>
        <p className="text-sm text-slate-500">
          Cadastro de grupos autorizados e status da sessão Baileys.
        </p>
      </div>
      <SessionPanel />
      <GroupsManager />
    </div>
  );
}
