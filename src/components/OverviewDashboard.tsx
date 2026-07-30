"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Inbox,
  Radio,
  RefreshCw,
  Send,
  ShoppingBag,
  Wifi,
} from "lucide-react";
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
        <div className="h-8 w-48 animate-pulse border-2 border-ink bg-ice-deep" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse border-[3px] border-ink bg-ice-deep shadow-brutal"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b-[3px] border-ink pb-4">
        <div>
          <p className="b-label mb-1">Dashboard</p>
          <h1 className="text-2xl font-black uppercase tracking-tight text-ink">
            Overview
          </h1>
          <p className="mt-0.5 text-sm font-medium text-muted">
            KPIs de {stats?.date ?? "—"} · America/Sao_Paulo
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
            className="b-btn b-btn-ghost !py-1.5 !text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.5} />
            Atualizar
          </button>
        </div>
      </div>

      {error ? (
        <p className="b-alert b-alert-danger" role="alert">
          {error}
        </p>
      ) : null}

      {stats && stats.sessionStatus !== "connected" ? (
        <p className="b-alert b-alert-danger" role="alert">
          <AlertTriangle className="mr-1 inline h-4 w-4" strokeWidth={2.5} />
          Sessão WhatsApp: {stats.sessionStatus}. Disparos bloqueados.{" "}
          <a
            href="/dashboard/bot"
            className="font-extrabold underline decoration-2 underline-offset-2"
          >
            Reconecte em Bot
          </a>
          .
        </p>
      ) : null}

      {stats && stats.dispatchesFailed > 0 ? (
        <p className="b-alert b-alert-warn" role="status">
          {stats.dispatchesFailed} falha(s) de envio hoje — veja Disparos.
        </p>
      ) : null}

      {stats ? (
        <>
          <MetaProgress sent={stats.dispatchesSent} cap={stats.dailyCap} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              label="Enviados hoje"
              value={String(stats.dispatchesSent)}
              hint={`Meta ${stats.dailyCap} · hourly ${stats.hourlyCap}`}
              icon={Send}
            />
            <KpiCard
              label="Falhas hoje"
              value={String(stats.dispatchesFailed)}
              alert={stats.dispatchesFailed > 0}
              icon={AlertTriangle}
            />
            <KpiCard
              label="Fila pendente"
              value={String(stats.dispatchesQueued)}
              hint="queued + sending"
              icon={Inbox}
            />
            <KpiCard
              label="Ofertas scrapadas hoje"
              value={String(stats.offersScrapedToday)}
              icon={ShoppingBag}
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
              icon={Wifi}
            />
            <KpiCard
              label="Último erro scrap"
              value={stats.lastScrapeError ? "Sim" : "Nenhum"}
              hint={stats.lastScrapeError ?? "—"}
              alert={Boolean(stats.lastScrapeError)}
              icon={Radio}
            />
          </div>
          {stats.dispatchesSent === 0 && stats.dispatchesQueued === 0 ? (
            <p className="border-2 border-dashed border-ink/40 bg-white/60 px-3 py-2 text-sm font-medium text-muted">
              0 disparos hoje.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
