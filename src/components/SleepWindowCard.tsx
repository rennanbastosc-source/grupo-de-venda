"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

/** Converte "HH:MM:SS" (Postgres time) → "HH:MM" pro input type=time. */
function toTimeInput(v: string | null | undefined): string {
  if (!v) return "";
  const m = v.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return "";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

export function SleepWindowCard() {
  const [sleepStart, setSleepStart] = useState("");
  const [sleepEnd, setSleepEnd] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao carregar settings");
      const s = data.settings ?? {};
      setSleepStart(toTimeInput(s.sleep_start));
      setSleepEnd(toTimeInput(s.sleep_end));
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

  async function patchSleep(
    start: string | null,
    end: string | null,
    okLabel: string,
  ) {
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sleep_start: start, sleep_end: end }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao salvar");
      const s = data.settings ?? {};
      setSleepStart(toTimeInput(s.sleep_start));
      setSleepEnd(toTimeInput(s.sleep_end));
      setMsg(okLabel);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const start = sleepStart.trim() || null;
    const end = sleepEnd.trim() || null;
    if ((start && !end) || (!start && end)) {
      setError("Preencha início e fim, ou desative a janela.");
      return;
    }
    await patchSleep(start, end, "Janela salva");
  }

  async function onDisable() {
    await patchSleep(null, null, "Janela desativada");
  }

  const active = Boolean(sleepStart && sleepEnd);

  return (
    <form
      onSubmit={onSave}
      className="grid gap-3 border-[3px] border-ink bg-white p-4 shadow-brutal"
    >
      <h2 className="text-sm font-black uppercase tracking-tight text-ink">
        Janela de descanso
      </h2>
      <p className="text-xs text-muted">
        Durante a janela os disparos ficam pausados — as ofertas continuam na
        fila e são enviadas quando a janela fecha.
      </p>
      <p className="text-xs font-bold text-ink">
        Horário de Brasília (America/Sao_Paulo)
      </p>

      {loading ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : (
        <>
          {active ? (
            <p
              className="border-[2px] border-ink bg-lime px-3 py-2 text-sm font-bold text-ink"
              role="status"
            >
              Descanso das {sleepStart} às {sleepEnd} — disparos pausados nesse
              período
            </p>
          ) : (
            <p className="text-xs text-muted">Janela desativada.</p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="b-label">Início</span>
              <input
                type="time"
                value={sleepStart}
                onChange={(e) => setSleepStart(e.target.value)}
                className="b-input"
              />
            </label>
            <label className="block text-sm">
              <span className="b-label">Fim</span>
              <input
                type="time"
                value={sleepEnd}
                onChange={(e) => setSleepEnd(e.target.value)}
                className="b-input"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className="b-btn">
              {busy ? "Salvando…" : "Salvar janela"}
            </button>
            <button
              type="button"
              disabled={busy || !active}
              onClick={() => void onDisable()}
              className="b-btn b-btn-ghost"
            >
              Desativar
            </button>
          </div>
        </>
      )}

      {msg ? (
        <p className="text-sm font-bold text-ok" role="status">
          {msg}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm font-bold text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
