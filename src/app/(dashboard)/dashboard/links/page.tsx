import { LinksManager } from "@/components/LinksManager";

export default function LinksPage() {
  return (
    <div className="space-y-5">
      <div className="border-b-[3px] border-ink pb-4">
        <p className="b-label mb-1">Afiliados</p>
        <h1 className="text-2xl font-black uppercase tracking-tight text-ink">
          Links promocionais
        </h1>
        <p className="mt-0.5 text-sm font-medium text-muted">
          Emitir e listar URLs afiliadas (Livelo, Méliuz, genérico).
        </p>
      </div>
      <LinksManager />
    </div>
  );
}
