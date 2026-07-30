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
  const [testText, setTestText] = useState("");
  const [testBusy, setTestBusy] = useState(false);

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

  async function onTestSend(e: FormEvent) {
    e.preventDefault();
    setTestBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/bot/test-send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: testText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha no teste");
      setMsg(`Teste enviado para ${data.phone}`);
      setTestText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setTestBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Disparos exigem WhatsApp conectado.{" "}
        <a
          href="/dashboard/bot"
          className="font-medium text-ink font-bold underline decoration-2 underline-offset-2"
        >
          Gerenciar sessão em Bot
        </a>
      </p>
      <form
        onSubmit={onEnqueue}
        className="grid gap-3 border-[3px] border-ink bg-white p-4 shadow-brutal"
      >
        <h2 className="text-sm font-black uppercase tracking-tight text-ink">
          Enfileirar disparo
        </h2>
        <label className="block text-sm">
          <span className="b-label">Oferta aprovada</span>
          <select
            required
            value={offerId}
            onChange={(e) => setOfferId(e.target.value)}
            className="b-input"
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
          <legend className="b-label">Grupos ativos</legend>
          <div className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto">
            {groups.length === 0 ? (
              <p className="text-muted">Nenhum grupo ativo.</p>
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
                    <span className="font-mono text-xs text-muted">
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
          className="w-fit b-btn"
        >
          Enfileirar
        </button>
      </form>

      <form
        onSubmit={onTestSend}
        className="grid gap-3 border-[3px] border-ink bg-white p-4 shadow-brutal"
      >
        <h2 className="text-sm font-black uppercase tracking-tight text-ink">
          Teste manual
        </h2>
        <p className="text-xs text-muted">
          Envia texto livre (máx. 200) para o próprio número do bot conectado.
        </p>
        <label className="block text-sm">
          <span className="b-label">Mensagem</span>
          <textarea
            value={testText}
            onChange={(e) => setTestText(e.target.value.slice(0, 200))}
            maxLength={200}
            rows={3}
            placeholder="Olá — teste de disparo"
            className="b-input text-ink"
          />
          <span className="mt-1 block text-xs text-muted">
            {testText.length}/200
          </span>
        </label>
        <button
          type="submit"
          disabled={testBusy || !testText.trim()}
          className="w-fit b-btn"
        >
          {testBusy ? "Enviando…" : "Enviar teste"}
        </button>
      </form>

      <form
        onSubmit={saveSettings}
        className="grid gap-3 border-[3px] border-ink bg-white p-4 shadow-brutal sm:grid-cols-3"
      >
        <h2 className="text-sm font-black uppercase tracking-tight text-ink sm:col-span-3">
          Rate limit
          {settings ? (
            <span className="ml-2 font-normal text-muted">
              (atual: {settings.daily_cap}/dia · {settings.hourly_cap}/h ·{" "}
              {settings.min_interval_sec}s)
            </span>
          ) : null}
        </h2>
        <label className="block text-sm">
          <span className="b-label">Daily cap</span>
          <input
            type="number"
            min={1}
            value={dailyCap}
            onChange={(e) => setDailyCap(e.target.value)}
            className="b-input"
          />
        </label>
        <label className="block text-sm">
          <span className="b-label">Hourly cap</span>
          <input
            type="number"
            min={1}
            value={hourlyCap}
            onChange={(e) => setHourlyCap(e.target.value)}
            className="b-input"
          />
        </label>
        <label className="block text-sm">
          <span className="b-label">Intervalo (s)</span>
          <input
            type="number"
            min={1}
            value={intervalSec}
            onChange={(e) => setIntervalSec(e.target.value)}
            className="b-input"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-fit b-btn b-btn-ghost sm:col-span-3"
        >
          Salvar limites
        </button>
      </form>

      {msg ? (
        <p className="text-sm text-muted" role="status">
          {msg}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-danger font-bold" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="b-label">Status</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
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
            onChange={(e) => setFilterFrom(e.target.value)}
            className="b-input !mt-1 !w-auto"
          />
        </label>
        <button
          type="button"
          onClick={() => void load()}
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
                <th className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider">Oferta</th>
                <th className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider">Grupo</th>
                <th className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider">Status</th>
                <th className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider">Erro</th>
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
