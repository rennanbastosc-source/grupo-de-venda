"use client";

export type PipelineCounts = {
  captionsPending: number;
  captionsReady: number;
  captionsFailed: number;
  jobsQueued: number;
  sentLast24h: number;
};

export type ScrapeRun = {
  source: string;
  started_at: string;
  finished_at: string | null;
  ok: boolean;
  items_found: number | null;
  items_upserted: number | null;
  error: string | null;
};

type Props = {
  sessionStatus: string;
  counts: PipelineCounts | null;
  lastScrapeRuns: ScrapeRun[];
  statusLoading: boolean;
  onRefresh: () => void;
};

export function DispatchPipelineStatus({
  sessionStatus,
  counts,
  lastScrapeRuns,
  statusLoading,
  onRefresh,
}: Props) {
  const sessionOk = sessionStatus === "connected";

  return (
    <div className="border-[3px] border-ink bg-white p-4 shadow-brutal">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-black uppercase tracking-tight text-ink">
          Status do pipeline
        </h2>
        <button
          type="button"
          onClick={onRefresh}
          disabled={statusLoading}
          className="b-btn b-btn-ghost !py-1.5"
        >
          {statusLoading ? "…" : "Atualizar"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted">
          WhatsApp
        </span>
        <span
          className={
            "border-[2px] border-ink px-2 py-0.5 text-xs font-black uppercase " +
            (sessionOk ? "bg-lime text-ink" : "bg-danger text-white")
          }
        >
          {sessionStatus}
        </span>
      </div>

      {counts ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(
            [
              ["Captions pend.", counts.captionsPending],
              ["Captions ok", counts.captionsReady],
              ["Captions falha", counts.captionsFailed],
              ["Jobs na fila", counts.jobsQueued],
              ["Enviados 24h", counts.sentLast24h],
            ] as const
          ).map(([label, n]) => (
            <div
              key={label}
              className="border-[2px] border-ink bg-[#fafaf5] px-2 py-2 text-center"
            >
              <div className="text-lg font-black tabular-nums text-ink">{n}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                {label}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4">
        <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-muted">
          Últimos scrapes
        </h3>
        {lastScrapeRuns.length === 0 ? (
          <p className="mt-1 text-xs text-muted">Nenhum scrape ainda.</p>
        ) : (
          <ul className="mt-2 divide-y divide-[#e5e5dc] border-[2px] border-ink">
            {lastScrapeRuns.map((r, i) => (
              <li
                key={`${r.source}-${r.started_at}-${i}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1.5 text-xs"
              >
                <span className="font-bold text-ink">{r.source}</span>
                <span
                  className={r.ok ? "font-bold text-ok" : "font-bold text-danger"}
                >
                  {r.ok ? "ok" : "falha"}
                </span>
                <span className="text-muted">
                  found {r.items_found ?? 0} · up {r.items_upserted ?? 0}
                </span>
                <span className="font-mono text-muted">
                  {r.started_at
                    ? new Date(r.started_at).toLocaleString("pt-BR", {
                        timeZone: "UTC",
                      })
                    : "—"}{" "}
                  UTC
                </span>
                {r.error ? (
                  <span className="w-full truncate text-danger font-bold">
                    {r.error}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
