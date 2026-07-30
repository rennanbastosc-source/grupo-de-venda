import { OffersManager } from "@/components/OffersManager";

export default function OfertasPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Ofertas</h1>
        <p className="text-sm text-slate-500">
          Pipeline de scrap (ML, Amazon) + cadastro manual.
        </p>
      </div>
      <OffersManager />
    </div>
  );
}
