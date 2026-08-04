"use client";

import { useCallback, useEffect, useState } from "react";

type ConnectionEvent = {
  id: number;
  status: string;
  detail: string | null;
  at: string;
};

const STATUS_LABEL: Record<string, string> = {
  connected: "conectado",
  disconnected: "desconectado",
  connecting: "conectando",
  waiting_pairing: "aguardando pareamento",
  qr: "QR gerado",
  logged_out: "sessão encerrada",
};

function fmtFortaleza(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Fortaleza",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function ConnectionLogModal({
  events,
  loading,
  error,
  onClose,
  onRefresh,
}: {
  events: ConnectionEvent[] | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function copyLogToClipboard() {
    if (!events || events.length === 0) return;
    const text = events
      .map((ev) => {
        const time = fmtFortaleza(ev.at);
        const label = STATUS_LABEL[ev.status] ?? ev.status;
        const detail = ev.detail ? ` | ${ev.detail}` : "";
        return `[${time}] ${label.toUpperCase()}${detail}`;
      })
      .join("\n");

    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl border-[3px] border-ink bg-white p-6 shadow-brutal space-y-4 relative max-h-[85vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="log-modal-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b-2 border-ink pb-3 shrink-0">
          <div>
            <h3 id="log-modal-title" className="text-lg font-black uppercase text-ink">
              Log de conexão WhatsApp
            </h3>
            <p className="text-xs text-muted font-medium mt-0.5">
              Status e erros gravados pelo worker (não é o log completo do Render)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="b-btn b-btn-ghost !px-2.5 !py-1 text-sm font-black"
            aria-label="Fechar modal"
          >
            ✕
          </button>
        </div>

        {/* Action bar inside modal */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="b-btn b-btn-ghost !px-3 !py-1 text-xs font-bold"
          >
            {loading ? "Atualizando…" : "Atualizar"}
          </button>

          {events && events.length > 0 ? (
            <button
              type="button"
              onClick={copyLogToClipboard}
              className="b-btn b-btn-ghost !px-3 !py-1 text-xs font-bold"
            >
              {copied ? "Copiado!" : "Copiar log"}
            </button>
          ) : null}
        </div>

        {/* Events list content */}
        <div className="overflow-y-auto flex-1 min-h-0 border-[3px] border-ink bg-ice/30 p-3 space-y-2">
          {error ? (
            <div className="p-2">
              <p className="text-sm text-danger font-bold" role="alert">
                {error}{" "}
                <button
                  type="button"
                  onClick={onRefresh}
                  className="underline decoration-2 underline-offset-2"
                >
                  tentar de novo
                </button>
              </p>
            </div>
          ) : loading && events === null ? (
            <p className="text-sm text-muted p-2">Carregando log completo…</p>
          ) : !events || events.length === 0 ? (
            <p className="text-sm text-muted p-2">Nenhum evento registrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {events.map((ev) => {
                const isError =
                  ev.status === "disconnected" ||
                  ev.status === "logged_out" ||
                  Boolean(ev.detail);

                return (
                  <div
                    key={ev.id}
                    className={`border-2 p-2 text-xs font-mono transition-colors ${
                      isError
                        ? "border-danger bg-danger/5 text-ink"
                        : "border-ink bg-white text-ink"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 font-bold mb-1">
                      <span className="text-muted">{fmtFortaleza(ev.at)}</span>
                      <span
                        className={`uppercase font-black px-1.5 py-0.5 border ${
                          ev.status === "connected"
                            ? "bg-lime/30 text-ink border-ink"
                            : isError
                            ? "bg-danger text-white border-ink"
                            : "bg-ice text-ink border-ink"
                        }`}
                      >
                        {STATUS_LABEL[ev.status] ?? ev.status}
                      </span>
                    </div>

                    {ev.detail ? (
                      <div className="mt-1.5 border-t border-ink/20 pt-1.5 whitespace-pre-wrap break-all text-xs font-semibold text-danger">
                        {ev.detail}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ConnectionHistoryCard() {
  const [events, setEvents] = useState<ConnectionEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bot/events");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao carregar histórico");
      setEvents(data.events ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <>
      <div className="border-[3px] border-ink bg-white p-4 shadow-brutal">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-black uppercase tracking-tight text-ink">
            Histórico de conexão
          </h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="text-ink-soft text-xs font-bold underline decoration-2 underline-offset-2"
            >
              {loading ? "Carregando…" : "Atualizar"}
            </button>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="b-btn b-btn-ghost !py-1 !px-2 text-xs font-black shadow-[2px_2px_0px_#000]"
            >
              Ver log de erros
            </button>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-danger font-bold" role="alert">
            {error}{" "}
            <button
              type="button"
              onClick={() => void load()}
              className="underline decoration-2 underline-offset-2"
            >
              tentar de novo
            </button>
          </p>
        ) : loading && events === null ? (
          <p className="text-sm text-muted">Carregando histórico…</p>
        ) : !events || events.length === 0 ? (
          <p className="text-sm text-muted">Nenhum evento registrado ainda.</p>
        ) : (
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
            {events.slice(0, 5).map((ev) => (
              <li key={ev.id} className="flex items-baseline gap-2">
                <span className="font-mono text-xs text-muted">
                  {fmtFortaleza(ev.at)}
                </span>
                <span
                  className={
                    ev.status === "connected"
                      ? "font-bold text-ink"
                      : "font-bold text-danger"
                  }
                >
                  {STATUS_LABEL[ev.status] ?? ev.status}
                </span>
                {ev.detail ? (
                  <span className="truncate text-xs text-muted" title={ev.detail}>
                    {ev.detail}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {isModalOpen ? (
        <ConnectionLogModal
          events={events}
          loading={loading}
          error={error}
          onClose={() => setIsModalOpen(false)}
          onRefresh={() => void load()}
        />
      ) : null}
    </>
  );
}
