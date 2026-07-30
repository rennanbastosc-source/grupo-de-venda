"use client";

import { useCallback, useEffect, useState } from "react";
import { KpiCard } from "@/components/KpiCard";
import { MetaProgress } from "@/components/MetaProgress";
import { SessionBadge } from "@/components/SessionBadge";
import type { OverviewStats } from "@/lib/stats/overview";

export function OverviewDashboard() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/stats/overview");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha stats");
      setStats(data.stats);
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
    const id = setInterval(() => {
      void load();
    }, 30_000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, [load]);

  if (loading && !stats) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg bg-slate-200"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Overview</h1>
          <p className="text-sm text-slate-500">
            KPIs de {stats?.date ?? "—"} (America/Sao_Paulo)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {stats ? <SessionBadge status={stats.sessionStatus} /> : null}
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm"
          >
            Atualizar
          </button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {stats && stats.sessionStatus !== "connected" ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          Sessão WhatsApp: {stats.sessionStatus}. Disparos bloqueados.{" "}
          <a
            href="/dashboard/bot"
            className="font-medium underline underline-offset-2"
          >
            Reconecte em Bot
          </a>
          .
        </p>
      ) : null}

      {stats && stats.dispatchesFailed > 0 ? (
        <p
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          role="status"
        >
          {stats.dispatchesFailed} falha(s) de envio hoje — veja Disparos.
        </p>
      ) : null}

      {stats ? (
        <>
          <MetaProgress sent={stats.dispatchesSent} cap={stats.dailyCap} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              label="Enviados hoje"
              value={String(stats.dispatchesSent)}
              hint={`Meta ${stats.dailyCap} · hourly ${stats.hourlyCap}`}
            />
            <KpiCard
              label="Falhas hoje"
              value={String(stats.dispatchesFailed)}
              alert={stats.dispatchesFailed > 0}
            />
            <KpiCard
              label="Fila pendente"
              value={String(stats.dispatchesQueued)}
              hint="queued + sending"
            />
            <KpiCard
              label="Ofertas scrapadas hoje"
              value={String(stats.offersScrapedToday)}
            />
            <KpiCard
              label="Sessão Baileys"
              value={stats.sessionStatus}
              alert={stats.sessionStatus !== "connected"}
              hint={
                stats.sessionStatus === "connected"
                  ? "Pronto para disparar"
                  : "Ação em Bot"
              }
            />
            <KpiCard
              label="Último erro scrap"
              value={stats.lastScrapeError ? "Sim" : "Nenhum"}
              hint={stats.lastScrapeError ?? "—"}
              alert={Boolean(stats.lastScrapeError)}
            />
          </div>
          {stats.dispatchesSent === 0 && stats.dispatchesQueued === 0 ? (
            <p className="text-sm text-slate-500">0 disparos hoje.</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
