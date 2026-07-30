export function PlaceholderCard({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">Em breve nesta fatia.</p>
    </div>
  );
}
