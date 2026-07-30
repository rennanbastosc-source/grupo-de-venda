import { SessionPanel } from "@/components/SessionPanel";

export default function BotPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Bot / Sessão</h1>
        <p className="text-sm text-slate-500">
          Worker Baileys (processo separado da Vercel).
        </p>
      </div>
      <SessionPanel />
    </div>
  );
}
