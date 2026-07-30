import { DispatchManager } from "@/components/DispatchManager";

export default function DisparosPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Disparos</h1>
        <p className="text-sm text-slate-500">
          Fila WhatsApp com rate limit e gate de link afiliado.
        </p>
      </div>
      <DispatchManager />
    </div>
  );
}
