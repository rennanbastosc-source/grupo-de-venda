"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Offer = { id: string; title: string; status: string };
type Group = { id: string; name: string; active: boolean; jid: string };
type Job = {
  id: string;
  status: string;
  error: string | null;
  created_at: string;
  sent_at: string | null;
  offers?: { title: string } | null;
  wa_groups?: { name: string; jid: string } | null;
};
type Settings = {
  daily_cap: number;
  hourly_cap: number;
  min_interval_sec: number;
  message_template: string;
};

export function DispatchManager() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [offerId, setOfferId] = useState("");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dailyCap, setDailyCap] = useState("35");
  const [hourlyCap, setHourlyCap] = useState("10");
  const [intervalSec, setIntervalSec] = useState("45");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [expandedError, setExpandedError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (filterStatus) qs.set("status", filterStatus);
      if (filterFrom) qs.set("from", filterFrom);
      const [oRes, gRes, jRes, sRes] = await Promise.all([
        fetch("/api/offers?status=approved"),
        fetch("/api/groups"),
        fetch(`/api/dispatch?${qs}`),
        fetch("/api/settings"),
      ]);
      const oData = await oRes.json();
      const gData = await gRes.json();
      const jData = await jRes.json();
      const sData = await sRes.json();
      if (!oRes.ok) throw new Error(oData.error || "ofertas");
      if (!gRes.ok) throw new Error(gData.error || "grupos");
      if (!jRes.ok) throw new Error(jData.error || "jobs");
      if (!sRes.ok) throw new Error(sData.error || "settings");
      setOffers(oData.offers ?? []);
      setGroups((gData.groups ?? []).filter((g: Group) => g.active));
      setJobs(jData.jobs ?? []);
      const s = sData.settings as Settings;
      setSettings(s);
      setDailyCap(String(s.daily_cap));
      setHourlyCap(String(s.hourly_cap));
      setIntervalSec(String(s.min_interval_sec));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterFrom]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  function toggleGroup(id: string) {
    setGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function onEnqueue(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offerId, groupIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha enqueue");
      setMsg(
        `Criados: ${data.created?.length ?? 0}` +
          (data.skipped?.length
            ? ` · ignorados: ${data.skipped.map((s: { reason: string }) => s.reason).join("; ")}`
            : ""),
      );
      setGroupIds([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          daily_cap: Number(dailyCap),
          hourly_cap: Number(hourlyCap),
          min_interval_sec: Number(intervalSec),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha settings");
      setSettings(data.settings);
      setMsg("Limites salvos");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Disparos exigem WhatsApp conectado.{" "}
        <a
          href="/dashboard/bot"
          className="font-medium text-slate-900 underline underline-offset-2"
        >
          Gerenciar sessão em Bot
        </a>
      </p>
      <form
        onSubmit={onEnqueue}
        className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        <h2 className="text-sm font-semibold text-slate-900">
          Enfileirar disparo
        </h2>
        <label className="block text-sm">
          <span className="text-slate-700">Oferta aprovada</span>
          <select
            required
            value={offerId}
            onChange={(e) => setOfferId(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">Selecione</option>
            {offers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="text-sm">
          <legend className="text-slate-700">Grupos ativos</legend>
          <div className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto">
            {groups.length === 0 ? (
              <p className="text-slate-500">Nenhum grupo ativo.</p>
            ) : (
              groups.map((g) => (
                <label key={g.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={groupIds.includes(g.id)}
                    onChange={() => toggleGroup(g.id)}
                  />
                  <span>
                    {g.name}{" "}
                    <span className="font-mono text-xs text-slate-400">
                      {g.jid}
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
        </fieldset>
        <button
          type="submit"
          disabled={busy || !offerId || groupIds.length === 0}
          className="w-fit rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          Enfileirar
        </button>
      </form>

      <form
        onSubmit={saveSettings}
        className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-3"
      >
        <h2 className="text-sm font-semibold text-slate-900 sm:col-span-3">
          Rate limit
          {settings ? (
            <span className="ml-2 font-normal text-slate-500">
              (atual: {settings.daily_cap}/dia · {settings.hourly_cap}/h ·{" "}
              {settings.min_interval_sec}s)
            </span>
          ) : null}
        </h2>
        <label className="block text-sm">
          <span className="text-slate-700">Daily cap</span>
          <input
            type="number"
            min={1}
            value={dailyCap}
            onChange={(e) => setDailyCap(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Hourly cap</span>
          <input
            type="number"
            min={1}
            value={hourlyCap}
            onChange={(e) => setHourlyCap(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Intervalo (s)</span>
          <input
            type="number"
            min={1}
            value={intervalSec}
            onChange={(e) => setIntervalSec(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-fit rounded-md border border-slate-200 px-4 py-2 text-sm sm:col-span-3"
        >
          Salvar limites
        </button>
      </form>

      {msg ? (
        <p className="text-sm text-slate-600" role="status">
          {msg}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="text-slate-700">Status</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="mt-1 block rounded-md border border-slate-300 px-2 py-1.5"
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
          <span className="text-slate-700">Desde (UTC)</span>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="mt-1 block rounded-md border border-slate-300 px-2 py-1.5"
          />
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm"
        >
          Atualizar histórico
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Carregando jobs…</p>
      ) : jobs.length === 0 ? (
        <p className="text-sm text-slate-500">Fila vazia.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Oferta</th>
                <th className="px-3 py-2 font-medium">Grupo</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Erro</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-b border-slate-100">
                  <td className="px-3 py-2">
                    {j.offers?.title ?? j.id.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2">{j.wa_groups?.name ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        j.status === "sent"
                          ? "text-green-700"
                          : j.status === "failed"
                            ? "text-red-600"
                            : "text-slate-700"
                      }
                    >
                      {j.status}
                    </span>
                  </td>
                  <td className="max-w-xs px-3 py-2 text-xs text-red-600">
                    {j.error ? (
                      <button
                        type="button"
                        className="text-left underline"
                        onClick={() =>
                          setExpandedError((cur) =>
                            cur === j.id ? null : j.id,
                          )
                        }
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
    </div>
  );
}
