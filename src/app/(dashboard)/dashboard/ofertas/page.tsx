import { OffersManager } from "@/components/OffersManager";

export default function OfertasPage() {
  return (
    <div className="space-y-5">
      <div className="border-b-[3px] border-ink pb-4">
        <p className="b-label mb-1">Catálogo</p>
        <h1 className="text-2xl font-black uppercase tracking-tight text-ink">
          Ofertas
        </h1>
        <p className="mt-0.5 text-sm font-medium text-muted">
          Pipeline de scrap (ML, Amazon) + cadastro manual.
        </p>
      </div>
      <OffersManager />
    </div>
  );
}
