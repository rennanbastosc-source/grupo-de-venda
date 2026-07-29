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
          <span className="text-slate-700">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 block rounded-md border border-slate-300 px-2 py-1.5"
          >
            <option value="">Todos</option>
            <option value="new">new</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
            <option value="sent">sent</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-slate-700">Fonte</span>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="mt-1 block rounded-md border border-slate-300 px-2 py-1.5"
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
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm"
        >
          Filtrar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void runScrapeNow()}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-60"
        >
          Rodar scrap agora
        </button>
      </div>

      {scrapeMsg ? (
        <p className="text-sm text-slate-600" role="status">
          {scrapeMsg}
        </p>
      ) : null}

      <form
        onSubmit={onManual}
        className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2"
      >
        <h2 className="text-sm font-semibold text-slate-900 sm:col-span-2">
          Oferta manual
        </h2>
        <label className="block text-sm sm:col-span-2">
          <span className="text-slate-700">Título</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-slate-700">URL</span>
          <input
            required
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Preço (R$)</span>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={busy}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm"
          >
            Adicionar
          </button>
        </div>
      </form>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Carregando ofertas…</p>
      ) : offers.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma oferta.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Título</th>
                <th className="px-3 py-2 font-medium">Fonte</th>
                <th className="px-3 py-2 font-medium">Preço</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => (
                <tr key={o.id} className="border-b border-slate-100">
                  <td className="max-w-xs truncate px-3 py-2">
                    <a
                      href={o.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-900 underline"
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
                        className="text-green-700 underline"
                        onClick={() => void setOfferStatus(o.id, "approved")}
                      >
                        Aprovar
                      </button>
                    ) : null}
                    {o.status !== "rejected" ? (
                      <button
                        type="button"
                        className="text-red-600 underline"
                        onClick={() => void setOfferStatus(o.id, "rejected")}
                      >
                        Rejeitar
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
