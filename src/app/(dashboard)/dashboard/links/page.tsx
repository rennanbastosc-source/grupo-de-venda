import { LinksManager } from "@/components/LinksManager";

export default function LinksPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Links promocionais
        </h1>
        <p className="text-sm text-slate-500">
          Emitir e listar URLs afiliadas (Livelo, Méliuz, genérico).
        </p>
      </div>
      <LinksManager />
    </div>
  );
}
