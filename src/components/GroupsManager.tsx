"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Group = {
  id: string;
  jid: string;
  name: string;
  active: boolean;
  daily_limit: number | null;
  notes: string | null;
};

export function GroupsManager() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jid, setJid] = useState("");
  const [name, setName] = useState("");
  const [dailyLimit, setDailyLimit] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/groups");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao listar");
      setGroups(data.groups ?? []);
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

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jid,
          name,
          daily_limit: dailyLimit ? Number(dailyLimit) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao criar");
      setJid("");
      setName("");
      setDailyLimit("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(g: Group) {
    const res = await fetch(`/api/groups/${g.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !g.active }),
    });
    if (res.ok) await load();
  }

  async function softDelete(g: Group) {
    const res = await fetch(`/api/groups/${g.id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={onCreate}
        className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2"
      >
        <h2 className="sm:col-span-2 text-sm font-semibold text-slate-900">
          Novo grupo
        </h2>
        <label className="block text-sm">
          <span className="text-slate-700">Nome</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">JID</span>
          <input
            required
            placeholder="120363...@g.us"
            value={jid}
            onChange={(e) => setJid(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Limite diário (opcional)</span>
          <input
            type="number"
            min={1}
            value={dailyLimit}
            onChange={(e) => setDailyLimit(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Cadastrar"}
          </button>
        </div>
      </form>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Carregando grupos…</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum grupo cadastrado.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Nome</th>
                <th className="px-3 py-2 font-medium">JID</th>
                <th className="px-3 py-2 font-medium">Ativo</th>
                <th className="px-3 py-2 font-medium">Limite</th>
                <th className="px-3 py-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id} className="border-b border-slate-100">
                  <td className="px-3 py-2">{g.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{g.jid}</td>
                  <td className="px-3 py-2">{g.active ? "sim" : "não"}</td>
                  <td className="px-3 py-2">{g.daily_limit ?? "—"}</td>
                  <td className="px-3 py-2 space-x-2">
                    <button
                      type="button"
                      onClick={() => toggleActive(g)}
                      className="text-slate-700 underline"
                    >
                      {g.active ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => softDelete(g)}
                      className="text-red-600 underline"
                    >
                      Desativar (soft)
                    </button>
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
