"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Group = {
  id: string;
  jid: string;
  name: string;
  active: boolean;
  notes: string | null;
};

export function GroupsManager() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jid, setJid] = useState("");
  const [name, setName] = useState("");
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
        body: JSON.stringify({ jid, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao criar");
      setJid("");
      setName("");
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
        className="grid gap-3 border-[3px] border-ink bg-white p-4 shadow-brutal sm:grid-cols-2"
      >
        <h2 className="sm:col-span-2 text-sm font-black uppercase tracking-tight text-ink">
          Novo grupo
        </h2>
        <label className="block text-sm">
          <span className="b-label">Nome</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="b-input"
          />
        </label>
        <label className="block text-sm">
          <span className="b-label">JID</span>
          <input
            required
            placeholder="120363...@g.us"
            value={jid}
            onChange={(e) => setJid(e.target.value)}
            className="b-input font-mono text-xs"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={saving}
            className="b-btn"
          >
            {saving ? "Salvando…" : "Cadastrar"}
          </button>
        </div>
      </form>

      {error ? (
        <p className="text-sm text-danger font-bold" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">Carregando grupos…</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted">Nenhum grupo cadastrado.</p>
      ) : (
        <div className="overflow-x-auto border-[3px] border-ink bg-white shadow-brutal">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b-2 border-ink bg-lime text-ink">
              <tr>
                <th className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider">Nome</th>
                <th className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider">JID</th>
                <th className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider">Ativo</th>
                <th className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id} className="border-b border-[#e5e5dc]">
                  <td className="px-3 py-2">{g.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{g.jid}</td>
                  <td className="px-3 py-2">{g.active ? "sim" : "não"}</td>
                  <td className="px-3 py-2 space-x-2">
                    <button
                      type="button"
                      onClick={() => toggleActive(g)}
                      className="text-ink-soft font-bold underline decoration-2 underline-offset-2"
                    >
                      {g.active ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => softDelete(g)}
                      className="text-danger font-bold underline decoration-2 underline-offset-2"
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
