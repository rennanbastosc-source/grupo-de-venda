"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { PriceBalanceModal } from "./PriceBalanceModal";

type Offer = {
  id: string;
  title: string;
  source: string;
  price_cents: number | null;
  original_price_cents?: number | null;
  status: string;
  caption_status?: string | null;
  caption_error?: string | null;
  caption?: string | null;
  url: string;
  scraped_at: string;
};

function formatPrice(cents: number | null) {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDateTime(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusBadge(status: string) {
  switch (status) {
    case "approved":
      return "bg-lime text-ink border-ink";
    case "rejected":
      return "bg-danger text-white border-ink";
    case "sent":
      return "bg-ice-deep text-ink border-ink";
    default:
      return "bg-white text-ink border-ink";
  }
}

function getCaptionBadge(status: string | null | undefined) {
  switch (status) {
    case "ready":
      return "bg-lime text-ink border-ink";
    case "failed":
      return "bg-danger text-white border-ink";
    case "pending":
      return "bg-ice-deep text-ink border-ink";
    default:
      return "bg-white text-ink-soft border-ink";
  }
}

function getSourceBadge(source: string) {
  switch (source) {
    case "mercadolivre":
      return "bg-[#fff059] text-ink";
    case "amazon":
      return "bg-[#ff9900] text-ink";
    case "shopee":
      return "bg-[#ee4d2d] text-white";
    case "magalu":
      return "bg-[#0086ff] text-white";
    default:
      return "bg-ice text-ink";
  }
}

export function OffersManager() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [captionStatus, setCaptionStatus] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(30);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState<string | null>(null);
  const [providers, setProviders] = useState<
    { id: string; name: string; active: boolean }[]
  >([]);
  const [defaultProviderId, setDefaultProviderId] = useState("");
  const [linkMsg, setLinkMsg] = useState<string | null>(null);
  const [sessions, setSessions] = useState<
    { source: string; status: string; lastError: string | null }[]
  >([]);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/scrape/sessions");
      const data = await res.json();
      if (res.ok) {
        if (Array.isArray(data.sessions)) setSessions(data.sessions);
        if (data.lastRunAt !== undefined) setLastRunAt(data.lastRunAt);
      }
    } catch {}
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (status) qs.set("status", status);
      if (source) qs.set("source", source);
      if (captionStatus) qs.set("caption_status", captionStatus);
      qs.set("page", String(page));
      qs.set("limit", String(limit));

      const res = await fetch(`/api/offers?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao listar");
      setOffers(data.offers ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [status, source, captionStatus, page, limit]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
      void loadSessions();
    }, 0);
    return () => clearTimeout(t);
  }, [load, loadSessions]);

  useEffect(() => {
    void fetch("/api/affiliate-providers")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.providers ?? []) as {
          id: string;
          name: string;
          active: boolean;
        }[];
        setProviders(list);
        const first = list.find((p) => p.active);
        if (first) setDefaultProviderId(first.id);
      })
      .catch(() => {});
  }, []);

  async function emitAffiliate(offerId: string) {
    setLinkMsg(null);
    // Sem providerId: o server roteia por source da oferta (mercadolivre →
    // meli.la; demais → generic-tag), igual ao pipeline. Evita re-criar o bug
    // "URL Invalid" ao emitir oferta amazon com provider ML manualmente.
    const res = await fetch("/api/affiliate-links", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ offerId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setLinkMsg(data.error || "Falha ao gerar link");
      return;
    }
    if (data.status === "failed") {
      setLinkMsg(data.error || "Provider falhou");
      return;
    }
    setLinkMsg(`Link: ${data.affiliateUrl}`);
  }

  async function onManual(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const price_cents = price
        ? Math.round(Number(price.replace(",", ".")) * 100)
        : null;
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, url, price_cents }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha");
      setTitle("");
      setUrl("");
      setPrice("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  async function setOfferStatus(id: string, next: string) {
    const res = await fetch(`/api/offers/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      await load();
      if (selectedOffer?.id === id) {
        setSelectedOffer((prev) => (prev ? { ...prev, status: next } : null));
      }
    }
  }

  async function runScrapeNow() {
    setBusy(true);
    setScrapeMsg(null);
    try {
      const res = await fetch("/api/scrape/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scrape falhou");
      setScrapeMsg(
        `Scrap: ${data.found ?? 0} achadas, ${data.upserted ?? 0} gravadas` +
          (data.errors?.length ? ` · erros: ${data.errors.join("; ")}` : ""),
      );
      await load();
      await loadSessions();
    } catch (e) {
      setScrapeMsg(e instanceof Error ? e.message : "Erro scrape");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Barra de Filtros & Ações Rápidas */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-[3px] border-ink bg-white p-4 shadow-brutal">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="b-label">Status</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="b-input !mt-1 !w-auto"
            >
              <option value="">Todos</option>
              <option value="new">Novas (new)</option>
              <option value="approved">Aprovadas (approved)</option>
              <option value="rejected">Rejeitadas (rejected)</option>
              <option value="sent">Enviadas (sent)</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="b-label">Fonte</span>
            <select
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setPage(1);
              }}
              className="b-input !mt-1 !w-auto"
            >
              <option value="">Todas</option>
              <option value="mercadolivre">Mercado Livre</option>
              <option value="amazon">Amazon</option>
              <option value="shopee">Shopee</option>
              <option value="magalu">Magalu</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="b-label">Caption</span>
            <select
              value={captionStatus}
              onChange={(e) => {
                setCaptionStatus(e.target.value);
                setPage(1);
              }}
              className="b-input !mt-1 !w-auto"
            >
              <option value="">Todas</option>
              <option value="none">none</option>
              <option value="pending">pending</option>
              <option value="ready">ready</option>
              <option value="failed">failed</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {lastRunAt ? (
            <span className="border-[2px] border-ink bg-ice px-2.5 py-1 text-xs font-extrabold text-ink shadow-[2px_2px_0px_#000]">
              Último scrap: {formatDateTime(lastRunAt)}
            </span>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void runScrapeNow()}
            className="b-btn !py-2"
          >
            Rodar scrap agora
          </button>
        </div>
      </div>

      {sessions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs" role="status">
          <span className="b-label text-ink-soft">Sessões:</span>
          {sessions.map((s) => (
            <span
              key={s.source}
              className={`border-[2px] border-ink px-2 py-0.5 font-bold uppercase ${
                s.status === "ok"
                  ? "bg-lime text-ink"
                  : s.status === "unauthenticated"
                  ? "bg-ice-deep text-ink"
                  : s.status === "error" || s.status === "expired"
                  ? "bg-danger text-white"
                  : "bg-white text-ink-soft"
              }`}
              title={s.lastError || undefined}
            >
              {s.source}: {s.status === "unauthenticated" ? "público" : s.status}
            </span>
          ))}
        </div>
      ) : null}

      {scrapeMsg ? (
        <p className="text-sm font-bold text-ink" role="status">
          {scrapeMsg}
        </p>
      ) : null}
      {linkMsg ? (
        <p className="text-sm font-bold text-ink" role="status">
          {linkMsg}
        </p>
      ) : null}

      {providers.some((p) => p.active) ? (
        <label className="block text-sm">
          <span className="b-label">Provider afiliado (padrão)</span>
          <select
            value={defaultProviderId}
            onChange={(e) => setDefaultProviderId(e.target.value)}
            className="b-input !mt-1 !w-auto"
          >
            {providers
              .filter((p) => p.active)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
      ) : null}

      {/* Formulário Manual */}
      <form
        onSubmit={onManual}
        className="grid gap-3 border-[3px] border-ink bg-white p-4 shadow-brutal sm:grid-cols-2"
      >
        <h2 className="text-sm font-black uppercase tracking-tight text-ink sm:col-span-2">
          Adicionar Oferta Manual
        </h2>
        <label className="block text-sm sm:col-span-2">
          <span className="b-label">Título</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="b-input"
            placeholder="Ex: Fone de Ouvido Bluetooth"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="b-label">URL</span>
          <input
            required
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="b-input"
            placeholder="https://..."
          />
        </label>
        <label className="block text-sm">
          <span className="b-label">Preço (R$)</span>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="b-input"
            placeholder="99.90"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={busy}
            className="b-btn b-btn-ghost"
          >
            Adicionar
          </button>
        </div>
      </form>

      {error ? (
        <p className="text-sm text-danger font-bold" role="alert">
          {error}
        </p>
      ) : null}

      {/* Quadro Resumo de Ofertas */}
      {loading ? (
        <div className="border-[3px] border-ink bg-white p-6 shadow-brutal text-center">
          <p className="text-sm font-bold text-ink">Carregando ofertas…</p>
        </div>
      ) : offers.length === 0 ? (
        <div className="border-[3px] border-ink bg-white p-6 shadow-brutal text-center">
          <p className="text-sm font-bold text-ink">Nenhuma oferta encontrada.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto border-[3px] border-ink bg-white shadow-brutal">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b-[3px] border-ink bg-lime text-ink">
                <tr>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-wider">
                    Oferta
                  </th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-wider">
                    Fonte
                  </th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-wider">
                    Preço
                  </th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-wider">
                    Caption
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-ink">
                {offers.map((o) => (
                  <tr key={o.id} className="hover:bg-ice/50 transition-colors">
                    <td className="max-w-md px-4 py-3">
                      <a
                        href={o.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-ink hover:underline line-clamp-2"
                        title={o.title}
                      >
                        {o.title}
                      </a>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedOffer(o)}
                        className={`inline-block border-[2px] border-ink px-2.5 py-1 text-[10px] font-black uppercase transition-transform active:translate-y-0.5 hover:-translate-y-0.5 shadow-[2px_2px_0px_#000] ${getSourceBadge(
                          o.source,
                        )}`}
                        title="Ver balanço de preço e detalhes da oferta"
                      >
                        {o.source} 🔍
                      </button>
                    </td>
                    <td className="px-4 py-3 font-bold text-ink whitespace-nowrap">
                      {formatPrice(o.price_cents)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-block border-[2px] px-2 py-0.5 text-[10px] font-black uppercase shadow-[2px_2px_0px_#000] ${getStatusBadge(
                          o.status,
                        )}`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-block border-[2px] px-2 py-0.5 text-[10px] font-black uppercase shadow-[2px_2px_0px_#000] ${getCaptionBadge(
                          o.caption_status,
                        )}`}
                      >
                        {o.caption_status ?? "none"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {o.status !== "approved" ? (
                          <button
                            type="button"
                            className="b-btn !bg-lime !text-ink !px-3 !py-1 !text-xs shadow-[2px_2px_0px_#000]"
                            onClick={() => void setOfferStatus(o.id, "approved")}
                          >
                            Aceitar
                          </button>
                        ) : null}
                        {o.status !== "rejected" ? (
                          <button
                            type="button"
                            className="b-btn !bg-danger !text-white !px-3 !py-1 !text-xs shadow-[2px_2px_0px_#000]"
                            onClick={() => void setOfferStatus(o.id, "rejected")}
                          >
                            Rejeitar
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="b-btn b-btn-ghost !px-3 !py-1 !text-xs shadow-[2px_2px_0px_#000]"
                          onClick={() => void emitAffiliate(o.id)}
                          title="Gerar link de afiliado"
                        >
                          Afiliado
                        </button>
                        {o.status === "approved" ? (
                          <a
                            href="/dashboard/disparos"
                            className="b-btn !bg-ice-deep !text-ink !px-3 !py-1 !text-xs shadow-[2px_2px_0px_#000]"
                          >
                            Disparar
                          </a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Controles de Paginação */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-[3px] border-ink bg-white p-4 shadow-brutal">
            <div className="flex items-center gap-2 text-sm font-bold text-ink">
              <span>Mostrar</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="b-input !py-1 !px-2 !w-auto"
              >
                <option value={30}>30</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>por página (Total: {total})</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="b-btn b-btn-ghost !px-3 !py-1 disabled:opacity-50"
              >
                ← Voltar
              </button>
              <span className="text-sm font-black uppercase text-ink">
                Página {page} de {totalPages || 1}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="b-btn b-btn-ghost !px-3 !py-1 disabled:opacity-50"
              >
                Avançar →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Balanço de Preço */}
      <PriceBalanceModal
        offer={selectedOffer}
        onClose={() => setSelectedOffer(null)}
        onApprove={async (id) => {
          await setOfferStatus(id, "approved");
        }}
        onReject={async (id) => {
          await setOfferStatus(id, "rejected");
        }}
        onEmitAffiliate={async (id) => {
          await emitAffiliate(id);
        }}
      />
    </div>
  );
}
