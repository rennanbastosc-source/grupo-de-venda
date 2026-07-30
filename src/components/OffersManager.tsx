"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Offer = {
  id: string;
  title: string;
  source: string;
  price_cents: number | null;
  status: string;
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

export function OffersManager() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (status) qs.set("status", status);
      if (source) qs.set("source", source);
      const res = await fetch(`/api/offers?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao listar");
      setOffers(data.offers ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [status, source]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

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
    if (!defaultProviderId) {
      setLinkMsg("Nenhum provider ativo");
      return;
    }
    setLinkMsg(null);
    const res = await fetch("/api/affiliate-links", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ offerId, providerId: defaultProviderId }),
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
    if (res.ok) await load();
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
    } catch (e) {
      setScrapeMsg(e instanceof Error ? e.message : "Erro scrape");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="b-label">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="b-input !mt-1 !w-auto"
          >
            <option value="">Todos</option>
            <option value="new">new</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
            <option value="sent">sent</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="b-label">Fonte</span>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="b-input !mt-1 !w-auto"
          >
            <option value="">Todas</option>
            <option value="mercadolivre">mercadolivre</option>
            <option value="amazon">amazon</option>
            <option value="shopee">shopee</option>
            <option value="magalu">magalu</option>
            <option value="manual">manual</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="b-btn b-btn-ghost !py-1.5"
        >
          Filtrar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void runScrapeNow()}
          className="b-btn !py-1.5"
        >
          Rodar scrap agora
        </button>
      </div>

      {scrapeMsg ? (
        <p className="text-sm text-muted" role="status">
          {scrapeMsg}
        </p>
      ) : null}
      {linkMsg ? (
        <p className="text-sm text-muted" role="status">
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

      <form
        onSubmit={onManual}
        className="grid gap-3 border-[3px] border-ink bg-white p-4 shadow-brutal sm:grid-cols-2"
      >
        <h2 className="text-sm font-black uppercase tracking-tight text-ink sm:col-span-2">
          Oferta manual
        </h2>
        <label className="block text-sm sm:col-span-2">
          <span className="b-label">Título</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="b-input"
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
          />
        </label>
        <label className="block text-sm">
          <span className="b-label">Preço (R$)</span>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="b-input"
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

      {loading ? (
        <p className="text-sm text-muted">Carregando ofertas…</p>
      ) : offers.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma oferta.</p>
      ) : (
        <div className="overflow-x-auto border-[3px] border-ink bg-white shadow-brutal">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b-2 border-ink bg-lime text-ink">
              <tr>
                <th className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider">Título</th>
                <th className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider">Fonte</th>
                <th className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider">Preço</th>
                <th className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider">Status</th>
                <th className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => (
                <tr key={o.id} className="border-b border-[#e5e5dc]">
                  <td className="max-w-xs truncate px-3 py-2">
                    <a
                      href={o.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-ink font-bold underline decoration-2 underline-offset-2"
                    >
                      {o.title}
                    </a>
                  </td>
                  <td className="px-3 py-2">{o.source}</td>
                  <td className="px-3 py-2">{formatPrice(o.price_cents)}</td>
                  <td className="px-3 py-2">{o.status}</td>
                  <td className="space-x-2 px-3 py-2">
                    {o.status !== "approved" ? (
                      <button
                        type="button"
                        className="text-ok font-bold underline decoration-2 underline-offset-2"
                        onClick={() => void setOfferStatus(o.id, "approved")}
                      >
                        Aprovar
                      </button>
                    ) : null}
                    {o.status !== "rejected" ? (
                      <button
                        type="button"
                        className="text-danger font-bold underline decoration-2 underline-offset-2"
                        onClick={() => void setOfferStatus(o.id, "rejected")}
                      >
                        Rejeitar
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="text-ink-soft font-bold underline decoration-2 underline-offset-2"
                      onClick={() => void emitAffiliate(o.id)}
                    >
                      Gerar link afiliado
                    </button>
                    {o.status === "approved" ? (
                      <a
                        href="/dashboard/disparos"
                        className="text-ink-soft font-bold underline decoration-2 underline-offset-2"
                      >
                        Disparar
                      </a>
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
