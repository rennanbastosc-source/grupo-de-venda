import { SessionPanel } from "@/components/SessionPanel";

export default function BotPage() {
  return (
    <div className="space-y-5">
      <div className="border-b-[3px] border-ink pb-4">
        <p className="b-label mb-1">Bot</p>
        <h1 className="text-2xl font-black uppercase tracking-tight text-ink">
          Conexão WhatsApp / Baileys
        </h1>
        <p className="mt-0.5 text-sm font-medium text-muted">
          Pareie o número disparador pelo painel (código + QR). Worker
          long-running separado da Vercel.
        </p>
      </div>
      <SessionPanel />
    </div>
  );
}
