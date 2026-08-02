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
  daily_offer_cap: number;
  message_template: string;
  auto_dispatch_enabled: boolean;
  auto_dispatch_group_ids: string[];
  default_affiliate_provider_id: string | null;
};
type Provider = { id: string; name: string; active: boolean };
type PipelineCounts = {
  captionsPending: number;
  captionsReady: number;
  captionsFailed: number;
  jobsQueued: number;
  sentLast24h: number;
};
type ScrapeRun = {
  source: string;
  started_at: string;
  finished_at: string | null;
  ok: boolean;
  items_found: number | null;
  items_upserted: number | null;
  error: string | null;
};

export function DispatchManager() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [offerId, setOfferId] = useState("");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dailyCap, setDailyCap] = useState("35");
  const [hourlyCap, setHourlyCap] = useState("10");
  const [intervalSec, setIntervalSec] = useState("45");
  const [offerCap, setOfferCap] = useState("10");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoGroupIds, setAutoGroupIds] = useState<string[]>([]);
  const [defaultProviderId, setDefaultProviderId] = useState("");
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [expandedError, setExpandedError] = useState<string | null>(null);
  const [testText, setTestText] = useState("");
  const [testBusy, setTestBusy] = useState(false);

  const [sessionStatus, setSessionStatus] = useState<string>("—");
  const [counts, setCounts] = useState<PipelineCounts | null>(null);
  const [lastScrapeRuns, setLastScrapeRuns] = useState<ScrapeRun[]>([]);

  const [scrapeBusy, setScrapeBusy] = useState(false);
  const [pipelineBusy, setPipelineBusy] = useState(false);
  const [dispatchBusy, setDispatchBusy] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState<string | null>(null);
  const [pipelineMsg, setPipelineMsg] = useState<string | null>(null);
  const [dispatchMsg, setDispatchMsg] = useState<string | null>(null);
  const [scrapeErr, setScrapeErr] = useState<string | null>(null);
  const [pipelineErr, setPipelineErr] = useState<string | null>(null);
  const [dispatchErr, setDispatchErr] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/pipeline/status");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "status");
      setSessionStatus(data.sessionStatus ?? "—");
      setCounts(data.counts ?? null);
      setLastScrapeRuns(data.lastScrapeRuns ?? []);
      if (data.settings) {
        const s = data.settings as Settings;
        setSettings(s);
        setDailyCap(String(s.daily_cap));
        setHourlyCap(String(s.hourly_cap));
        setIntervalSec(String(s.min_interval_sec));
        setOfferCap(String(s.daily_offer_cap ?? 10));
        setMessageTemplate(s.message_template ?? "");
        setAutoEnabled(!!s.auto_dispatch_enabled);
        setAutoGroupIds(s.auto_dispatch_group_ids ?? []);
        setDefaultProviderId(s.default_affiliate_provider_id ?? "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro status");
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (filterStatus) qs.set("status", filterStatus);
      if (filterFrom) qs.set("from", filterFrom);
      const [oRes, gRes, jRes, sRes, pRes] = await Promise.all([
        fetch("/api/offers?status=approved"),
        fetch("/api/groups"),
        fetch(`/api/dispatch?${qs}`),
        fetch("/api/settings"),
        fetch("/api/affiliate-providers"),
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
      setOfferCap(String(s.daily_offer_cap ?? 10));
      setMessageTemplate(s.message_template ?? "");
      setAutoEnabled(!!s.auto_dispatch_enabled);
      setAutoGroupIds(s.auto_dispatch_group_ids ?? []);
      setDefaultProviderId(s.default_affiliate_provider_id ?? "");
      if (pRes.ok) {
        const pData = await pRes.json();
        setProviders(
          (pData.providers ?? []).filter((p: Provider) => p.active !== false),
        );
      } else {
        setProviders(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterFrom]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
      void loadStatus();
    }, 0);
    return () => clearTimeout(t);
  }, [load, loadStatus]);

  function toggleGroup(id: string) {
    setGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleAutoGroup(id: string) {
    setAutoGroupIds((prev) =>
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
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    if (!messageTemplate.includes("{{affiliate_url}}")) {
      setError("Template deve conter {{affiliate_url}}");
      return;
    }
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
          daily_offer_cap: Number(offerCap),
          message_template: messageTemplate,
          auto_dispatch_enabled: autoEnabled,
          auto_dispatch_group_ids: autoGroupIds,
          default_affiliate_provider_id: defaultProviderId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha settings");
      setSettings(data.settings);
      setMsg("Configuração salva");
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

  async function runScrape() {
    setScrapeBusy(true);
    setScrapeMsg(null);
    setScrapeErr(null);
    try {
      const res = await fetch("/api/scrape/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scrape falhou");
      setScrapeMsg(
        `found ${data.found ?? 0} · upserted ${data.upserted ?? 0}` +
          (data.errors?.length ? ` · erros: ${data.errors.join("; ")}` : ""),
      );
      await loadStatus();
    } catch (e) {
      setScrapeErr(e instanceof Error ? e.message : "Erro scrape");
    } finally {
      setScrapeBusy(false);
    }
  }

  async function runPipeline() {
    setPipelineBusy(true);
    setPipelineMsg(null);
    setPipelineErr(null);
    try {
      const res = await fetch("/api/pipeline/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Pipeline falhou");
      setPipelineMsg(
        `export ${data.exported ?? 0} · caption ${data.captioned ?? 0} · import ${data.imported ?? 0} · afiliado ${data.affiliates ?? 0} · fila ${data.enqueued ?? 0}` +
          (data.errors?.length ? ` · erros: ${data.errors.join("; ")}` : ""),
      );
      await load();
      await loadStatus();
    } catch (e) {
      setPipelineErr(e instanceof Error ? e.message : "Erro pipeline");
    } finally {
      setPipelineBusy(false);
    }
  }

  async function runDispatch() {
    setDispatchBusy(true);
    setDispatchMsg(null);
    setDispatchErr(null);
    try {
      const res = await fetch("/api/dispatch/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Dispatch falhou");
      setDispatchMsg(
        `processados ${data.processed ?? 0} · enviados ${data.sent ?? 0} · falhas ${data.failed ?? 0}` +
          (data.skipped != null ? ` · skip ${data.skipped}` : "") +
          (data.stoppedReason ? ` · parou: ${data.stoppedReason}` : ""),
      );
      await load();
      await loadStatus();
    } catch (e) {
      setDispatchErr(e instanceof Error ? e.message : "Erro dispatch");
    } finally {
      setDispatchBusy(false);
    }
  }

  const sessionOk = sessionStatus === "connected";

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

      {/* 1. Status do pipeline */}
      <div className="border-[3px] border-ink bg-white p-4 shadow-brutal">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-black uppercase tracking-tight text-ink">
            Status do pipeline
          </h2>
          <button
            type="button"
            onClick={() => void loadStatus()}
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
              (sessionOk
                ? "bg-lime text-ink"
                : "bg-danger text-white")
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
                <div className="text-lg font-black tabular-nums text-ink">
                  {n}
                </div>
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
                    className={
                      r.ok ? "font-bold text-ok" : "font-bold text-danger"
                    }
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

      {/* 2. Ações manuais */}
      <div className="border-[3px] border-ink bg-white p-4 shadow-brutal">
        <h2 className="text-sm font-black uppercase tracking-tight text-ink">
          Ações manuais
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2 content-start">
            <button
              type="button"
              disabled={scrapeBusy}
              onClick={() => void runScrape()}
              className="b-btn w-full"
            >
              {scrapeBusy ? "Scrapando…" : "Rodar scrape agora"}
            </button>
            {scrapeMsg ? (
              <p className="text-xs text-muted" role="status">
                {scrapeMsg}
              </p>
            ) : null}
            {scrapeErr ? (
              <p className="text-xs text-danger font-bold" role="alert">
                {scrapeErr}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2 content-start">
            <button
              type="button"
              disabled={pipelineBusy}
              onClick={() => void runPipeline()}
              className="b-btn w-full"
            >
              {pipelineBusy ? "Pipeline…" : "Rodar pipeline agora"}
            </button>
            {pipelineMsg ? (
              <p className="text-xs text-muted" role="status">
                {pipelineMsg}
              </p>
            ) : null}
            {pipelineErr ? (
              <p className="text-xs text-danger font-bold" role="alert">
                {pipelineErr}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2 content-start">
            <button
              type="button"
              disabled={dispatchBusy}
              onClick={() => void runDispatch()}
              className="b-btn w-full"
            >
              {dispatchBusy ? "Processando…" : "Processar fila agora"}
            </button>
            {dispatchMsg ? (
              <p className="text-xs text-muted" role="status">
                {dispatchMsg}
              </p>
            ) : null}
            {dispatchErr ? (
              <p className="text-xs text-danger font-bold" role="alert">
                {dispatchErr}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* 3. Configuração */}
      <form
        onSubmit={saveSettings}
        className="grid gap-3 border-[3px] border-ink bg-white p-4 shadow-brutal sm:grid-cols-4"
      >
        <h2 className="text-sm font-black uppercase tracking-tight text-ink sm:col-span-4">
          Rate limit
          {settings ? (
            <span className="ml-2 font-normal text-muted">
              (atual: {settings.daily_offer_cap ?? 10} ofertas/dia ·{" "}
              {settings.daily_cap} msgs/dia · {settings.hourly_cap}/h ·{" "}
              {settings.min_interval_sec}s · horários em America/Fortaleza)
            </span>
          ) : null}
        </h2>
        <label className="block text-sm">
          <span className="b-label">Ofertas/dia</span>
          <input
            type="number"
            min={1}
            value={offerCap}
            onChange={(e) => setOfferCap(e.target.value)}
            className="b-input"
          />
        </label>
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

        <div className="sm:col-span-3 border-t-[3px] border-ink pt-3 grid gap-2">
          <h2 className="text-sm font-black uppercase tracking-tight text-ink">
            Template da mensagem
          </h2>
          <p className="text-xs text-muted">
            Obrigatório:{" "}
            <code className="font-mono font-bold text-ink">
              {"{{affiliate_url}}"}
            </code>
          </p>
          <label className="block text-sm">
            <span className="sr-only">Template</span>
            <textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              rows={5}
              className="b-input font-mono text-sm text-ink"
              placeholder={"Oferta: {{title}}\n{{affiliate_url}}"}
            />
          </label>
        </div>

        <div className="sm:col-span-3 border-t-[3px] border-ink pt-3 grid gap-3">
          <h2 className="text-sm font-black uppercase tracking-tight text-ink">
            Auto-dispatch
          </h2>
          <p className="text-xs text-muted">
            Enfileira ofertas com legenda pronta nos grupos marcados.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoEnabled}
              onChange={(e) => setAutoEnabled(e.target.checked)}
            />
            <span className="font-bold">Auto-dispatch</span>
          </label>
          <fieldset className="text-sm">
            <legend className="b-label">Grupos (auto)</legend>
            <div className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto">
              {groups.length === 0 ? (
                <p className="text-muted">Nenhum grupo ativo.</p>
              ) : (
                groups.map((g) => (
                  <label key={g.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={autoGroupIds.includes(g.id)}
                      onChange={() => toggleAutoGroup(g.id)}
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
          {providers ? (
            <label className="block text-sm">
              <span className="b-label">Provider padrão</span>
              <select
                value={defaultProviderId}
                onChange={(e) => setDefaultProviderId(e.target.value)}
                className="b-input"
              >
                <option value="">Nenhum</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-fit b-btn b-btn-ghost sm:col-span-3"
        >
          Salvar
        </button>
      </form>

      {/* 4. Enfileirar manual */}
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

      {/* 5. Teste manual */}
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

      {/* 6. Histórico */}
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
