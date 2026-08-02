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
  });
}

export function ConnectionHistoryCard() {
  const [events, setEvents] = useState<ConnectionEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    <div className="border-[3px] border-ink bg-white p-4 shadow-brutal">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-tight text-ink">
          Histórico de conexão
        </h2>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="text-ink-soft text-xs font-bold underline decoration-2 underline-offset-2"
        >
          {loading ? "Carregando…" : "Atualizar"}
        </button>
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
        <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
          {events.map((ev) => (
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
  );
}
