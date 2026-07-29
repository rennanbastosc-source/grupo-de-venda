"use client";

import { useCallback, useEffect, useState } from "react";

type SessionUi = {
  status: string;
  hasQr: boolean;
  qrDataUrl: string | null;
  lastError: string | null;
  canDispatch: boolean;
};

const statusLabel: Record<string, string> = {
  disconnected: "Desconectado",
  qr: "Aguardando QR",
  connecting: "Conectando",
  connected: "Conectado",
};

export function SessionPanel() {
  const [session, setSession] = useState<SessionUi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const st = await fetch("/api/bot/status").then((r) => r.json());
      let qrDataUrl: string | null = null;
      if (st.status === "qr" || st.hasQr) {
        const qr = await fetch("/api/bot/qr").then((r) => r.json());
        qrDataUrl = qr.qrDataUrl ?? null;
      }
      setSession({ ...st, qrDataUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar sessão");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const boot = setTimeout(() => {
      void load();
    }, 0);
    const t = setInterval(() => {
      void load();
    }, 5000);
    return () => {
      clearTimeout(boot);
      clearInterval(t);
    };
  }, [load]);

  if (loading && !session) {
    return <p className="text-sm text-slate-500">Carregando sessão…</p>;
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Sessão Baileys</h2>
          <p className="text-sm text-slate-600">
            Status:{" "}
            <span className="font-medium">
              {statusLabel[session?.status ?? ""] ?? session?.status ?? "—"}
            </span>
            {session?.canDispatch ? " · pronto para disparo" : " · envios pausados"}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          Atualizar
        </button>
      </div>
      {(error || session?.lastError) && (
        <p className="text-sm text-red-600" role="alert">
          {error || session?.lastError}
        </p>
      )}
      {session?.qrDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={session.qrDataUrl}
          alt="QR code WhatsApp"
          className="mx-auto h-48 w-48 rounded border border-slate-200"
        />
      ) : session?.status === "qr" ? (
        <p className="text-sm text-slate-500">QR expirado — clique em Atualizar.</p>
      ) : null}
    </div>
  );
}
