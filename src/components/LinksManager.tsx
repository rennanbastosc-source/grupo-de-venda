"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Provider = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  active: boolean;
};

type LinkRow = {
  id: string;
  offer_id: string | null;
  original_url: string;
  affiliate_url: string;
  status: string;
  error: string | null;
  created_at: string;
  affiliate_providers?: { slug: string; name: string } | null;
};

export function LinksManager() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [offerId, setOfferId] = useState("");
  const [providerId, setProviderId] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [lastUrl, setLastUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, lRes] = await Promise.all([
        fetch("/api/affiliate-providers"),
        fetch("/api/affiliate-links"),
      ]);
      const pData = await pRes.json();
      const lData = await lRes.json();
      if (!pRes.ok) throw new Error(pData.error || "Erro providers");
      if (!lRes.ok) throw new Error(lData.error || "Erro links");
      const list = (pData.providers ?? []) as Provider[];
      setProviders(list);
      setLinks(lData.links ?? []);
      setProviderId((cur) => cur || list.find((p) => p.active)?.id || "");
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

  async function onEmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setLastUrl(null);
    try {
      const res = await fetch("/api/affiliate-links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerId,
          url: url || undefined,
          offerId: offerId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao emitir");
      if (data.status === "failed") {
        setError(data.error || "Provider falhou");
      } else {
        setLastUrl(data.affiliateUrl);
      }
      setUrl("");
      setOfferId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  async function copyUrl(u: string) {
    try {
      await navigator.clipboard.writeText(u);
      setCopied(u);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("Não foi possível copiar");
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={onEmit}
        className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2"
      >
        <h2 className="text-sm font-semibold text-slate-900 sm:col-span-2">
          Emitir link afiliado
        </h2>
        <label className="block text-sm sm:col-span-2">
          <span className="text-slate-700">URL original</span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Offer ID (opcional)</span>
          <input
            value={offerId}
            onChange={(e) => setOfferId(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Provider</span>
          <select
            required
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="" disabled>
              Selecione
            </option>
            {providers
              .filter((p) => p.active)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.kind})
                </option>
              ))}
          </select>
        </label>
        <div className="flex items-end sm:col-span-2">
          <button
            type="submit"
            disabled={busy || !providerId}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {busy ? "Emitindo…" : "Emitir"}
          </button>
        </div>
      </form>

      {lastUrl ? (
        <p className="text-sm text-slate-700" role="status">
          Link:{" "}
          <button
            type="button"
            className="font-mono text-xs underline"
            onClick={() => void copyUrl(lastUrl)}
          >
            {lastUrl}
          </button>
          {copied === lastUrl ? (
            <span className="ml-2 text-green-700">Copiado</span>
          ) : null}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">
          Providers ativos
        </h2>
        {providers.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum provider.</p>
        ) : (
          <ul className="flex flex-wrap gap-2 text-sm">
            {providers.map((p) => (
              <li
                key={p.id}
                className={`rounded-full border px-3 py-1 ${
                  p.active
                    ? "border-slate-300 bg-white"
                    : "border-slate-200 text-slate-400 line-through"
                }`}
              >
                {p.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Carregando histórico…</p>
      ) : links.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma emissão.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Provider</th>
                <th className="px-3 py-2 font-medium">Original</th>
                <th className="px-3 py-2 font-medium">Afiliado</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.id} className="border-b border-slate-100">
                  <td className="px-3 py-2">
                    {l.affiliate_providers?.name ?? "—"}
                  </td>
                  <td className="max-w-[10rem] truncate px-3 py-2 font-mono text-xs">
                    {l.original_url}
                  </td>
                  <td className="max-w-[12rem] truncate px-3 py-2 font-mono text-xs">
                    {l.affiliate_url}
                  </td>
                  <td className="px-3 py-2">
                    {l.status}
                    {l.error ? (
                      <span className="block text-xs text-red-600">
                        {l.error}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {l.status === "ok" ? (
                      <button
                        type="button"
                        className="text-slate-700 underline"
                        onClick={() => void copyUrl(l.affiliate_url)}
                      >
                        {copied === l.affiliate_url ? "Copiado" : "Copiar"}
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
