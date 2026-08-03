"use client";

export type DispatchJobRow = {
  id: string;
  status: string;
  error: string | null;
  created_at: string;
  sent_at: string | null;
  offers?: { title: string } | null;
  wa_groups?: { name: string; jid: string } | null;
};

type Props = {
  jobs: DispatchJobRow[];
  loading: boolean;
  filterStatus: string;
  filterFrom: string;
  expandedError: string | null;
  onFilterStatus: (v: string) => void;
  onFilterFrom: (v: string) => void;
  onRefresh: () => void;
  onToggleError: (id: string) => void;
};

export function DispatchJobsTable({
  jobs,
  loading,
  filterStatus,
  filterFrom,
  expandedError,
  onFilterStatus,
  onFilterFrom,
  onRefresh,
  onToggleError,
}: Props) {
  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="b-label">Status</span>
          <select
            value={filterStatus}
            onChange={(e) => onFilterStatus(e.target.value)}
            className="b-input !mt-1 !w-auto"
          >
            <option value="">Todos</option>
            <option value="queued">queued</option>
            <option value="sending">sending</option>
            <option value="sent">sent</option>
            <option value="failed">failed</option>
            <option value="skipped">skipped</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="b-label">Desde (UTC)</span>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => onFilterFrom(e.target.value)}
            className="b-input !mt-1 !w-auto"
          />
        </label>
        <button
          type="button"
          onClick={onRefresh}
          className="b-btn b-btn-ghost !py-1.5"
        >
          Atualizar histórico
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Carregando jobs…</p>
      ) : jobs.length === 0 ? (
        <p className="text-sm text-muted">Fila vazia.</p>
      ) : (
        <div className="overflow-x-auto border-[3px] border-ink bg-white shadow-brutal">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b-2 border-ink bg-lime text-ink">
              <tr>
                <th className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider">
                  Oferta
                </th>
                <th className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider">
                  Grupo
                </th>
                <th className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider">
                  Status
                </th>
                <th className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider">
                  Erro
                </th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-b border-[#e5e5dc]">
                  <td className="px-3 py-2">
                    {j.offers?.title ?? j.id.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2">{j.wa_groups?.name ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        j.status === "sent"
                          ? "text-ok"
                          : j.status === "failed"
                            ? "text-danger font-bold"
                            : "text-ink-soft"
                      }
                    >
                      {j.status}
                    </span>
                  </td>
                  <td className="max-w-xs px-3 py-2 text-xs text-danger font-bold">
                    {j.error ? (
                      <button
                        type="button"
                        className="text-left font-bold underline decoration-2 underline-offset-2"
                        onClick={() => onToggleError(j.id)}
                      >
                        {expandedError === j.id
                          ? j.error
                          : j.error.length > 48
                            ? `${j.error.slice(0, 48)}…`
                            : j.error}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
