export function MetaProgress({ sent, cap }: { sent: number; cap: number }) {
  const pct = cap > 0 ? Math.min(100, Math.round((sent / cap) * 100)) : 0;
  return (
    <div className="border-[3px] border-ink bg-white p-4 shadow-brutal">
      <div className="flex items-baseline justify-between gap-2">
        <p className="b-label">Meta do dia</p>
        <p className="text-sm font-black tabular-nums text-ink">
          {sent}{" "}
          <span className="font-bold text-muted">/ {cap}</span>
        </p>
      </div>
      <div
        className="mt-3 h-4 overflow-hidden border-2 border-ink bg-ice-deep"
        role="progressbar"
        aria-valuenow={sent}
        aria-valuemin={0}
        aria-valuemax={cap}
        aria-label={`${sent} de ${cap} disparos`}
      >
        <div
          className="h-full bg-purple transition-all"
          style={{
            width: `${pct}%`,
            backgroundImage:
              "repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,.15) 4px, rgba(255,255,255,.15) 8px)",
          }}
        />
      </div>
      <p className="mt-2 text-xs font-bold uppercase tracking-wider text-muted">
        {pct}% da meta diária
      </p>
    </div>
  );
}
