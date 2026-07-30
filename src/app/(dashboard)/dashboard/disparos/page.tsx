import { DispatchManager } from "@/components/DispatchManager";

export default function DisparosPage() {
  return (
    <div className="space-y-5">
      <div className="border-b-[3px] border-ink pb-4">
        <p className="b-label mb-1">Fila</p>
        <h1 className="text-2xl font-black uppercase tracking-tight text-ink">
          Disparos
        </h1>
        <p className="mt-0.5 text-sm font-medium text-muted">
          Fila WhatsApp com rate limit e gate de link afiliado.
        </p>
      </div>
      <DispatchManager />
    </div>
  );
}
