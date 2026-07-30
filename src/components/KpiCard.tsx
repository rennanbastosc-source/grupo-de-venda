import type { LucideIcon } from "lucide-react";

export function KpiCard({
  label,
  value,
  hint,
  alert,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  alert?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <div
      className={`relative border-[3px] border-ink bg-white p-4 shadow-brutal ${
        alert ? "bg-[#fff1f2]" : ""
      }`}
    >
      <div
        className={`absolute -right-1 -top-1 h-4 w-4 border-2 border-ink ${
          alert ? "bg-danger" : "bg-lime"
        }`}
      />
      <div className="flex items-start justify-between gap-2">
        <p className="b-label">{label}</p>
        {Icon ? (
          <Icon
            className={`h-4 w-4 shrink-0 ${alert ? "text-danger" : "text-purple"}`}
            strokeWidth={2.5}
          />
        ) : null}
      </div>
      <p
        className={`mt-2 text-3xl font-black tabular-nums tracking-tight ${
          alert ? "text-danger" : "text-ink"
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs font-medium text-muted">{hint}</p> : null}
    </div>
  );
}
