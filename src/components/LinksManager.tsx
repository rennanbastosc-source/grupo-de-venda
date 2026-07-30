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
        className="grid gap-3 border-[3px] border-ink bg-white p-4 shadow-brutal sm:grid-cols-2"
      >
        <h2 className="text-sm font-black uppercase tracking-tight text-ink sm:col-span-2">
          Emitir link afiliado
        </h2>
        <label className="block text-sm sm:col-span-2">
          <span className="b-label">URL original</span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="b-input"
          />
        </label>
        <label className="block text-sm">
          <span className="b-label">Offer ID (opcional)</span>
          <input
            value={offerId}
            onChange={(e) => setOfferId(e.target.value)}
            className="b-input font-mono text-xs"
          />
        </label>
        <label className="block text-sm">
          <span className="b-label">Provider</span>
          <select
            required
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            className="b-input"
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
            className="b-btn"
          >
            {busy ? "Emitindo…" : "Emitir"}
          </button>
        </div>
      </form>

      {lastUrl ? (
        <p className="text-sm text-ink-soft" role="status">
          Link:{" "}
          <button
            type="button"
            className="font-mono text-xs font-bold underline decoration-2 underline-offset-2"
            onClick={() => void copyUrl(lastUrl)}
          >
            {lastUrl}
          </button>
          {copied === lastUrl ? (
            <span className="ml-2 text-ok">Copiado</span>
          ) : null}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-danger font-bold" role="alert">
          {error}
        </p>
      ) : null}

      <div>
        <h2 className="mb-2 text-sm font-black uppercase tracking-tight text-ink">
          Providers ativos
        </h2>
        {providers.length === 0 ? (
          <p className="text-sm text-muted">Nenhum provider.</p>
        ) : (
          <ul className="flex flex-wrap gap-2 text-sm">
            {providers.map((p) => (
              <li
                key={p.id}
                className={`rounded-full border px-3 py-1 ${
                  p.active
                    ? "border-ink bg-white"
                    : "border-ink text-muted line-through"
                }`}
              >
                {p.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Carregando histórico…</p>
      ) : links.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma emissão.</p>
      ) : (
        <div className="overflow-x-auto border-[3px] border-ink bg-white shadow-brutal">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b-2 border-ink bg-lime text-ink">
              <tr>
                <th className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider">Provider</th>
                <th className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider">Original</th>
                <th className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider">Afiliado</th>
                <th className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider">Status</th>
                <th className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.id} className="border-b border-[#e5e5dc]">
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
                      <span className="block text-xs text-danger font-bold">
                        {l.error}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {l.status === "ok" ? (
                      <button
                        type="button"
                        className="text-ink-soft font-bold underline decoration-2 underline-offset-2"
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
