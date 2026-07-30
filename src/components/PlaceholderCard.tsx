export function PlaceholderCard({ title }: { title: string }) {
  return (
    <div className="border-[3px] border-dashed border-ink bg-white p-10 text-center shadow-brutal">
      <h2 className="text-lg font-black uppercase tracking-tight text-ink">
        {title}
      </h2>
      <p className="mt-2 text-sm font-medium text-muted">Em breve nesta fatia.</p>
    </div>
  );
}
