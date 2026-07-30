export function MetaProgress({
  sent,
  cap,
}: {
  sent: number;
  cap: number;
}) {
  const pct = cap > 0 ? Math.min(100, Math.round((sent / cap) * 100)) : 0;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Meta do dia
        </p>
        <p className="text-sm font-medium tabular-nums text-slate-900">
          {sent} de {cap}
        </p>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={sent}
        aria-valuemin={0}
        aria-valuemax={cap}
        aria-label={`${sent} de ${cap} disparos`}
      >
        <div
          className="h-full rounded-full bg-slate-900 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">{pct}% da meta diária</p>
    </div>
  );
}
