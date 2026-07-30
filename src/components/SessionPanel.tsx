"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { SessionBadge } from "@/components/SessionBadge";
import { maskPhone } from "@/lib/wa/phone";

type SessionUi = {
  status: string;
  hasQr: boolean;
  hasPairingCode: boolean;
  qrDataUrl: string | null;
  pairingCode: string | null;
  phone: string | null;
  lastError: string | null;
  canDispatch: boolean;
};

const needsPairForm = (status: string) =>
  status === "disconnected" ||
  status === "waiting_pairing" ||
  status === "logged_out";

function isWorkerOfflineError(msg: string | null | undefined): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return (
    m.includes("worker") ||
    m.includes("econnrefused") ||
    m.includes("fetch failed") ||
    m.includes("offline") ||
    m.includes("não configurado")
  );
}

export function SessionPanel() {
  const [session, setSession] = useState<SessionUi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [pairing, setPairing] = useState(false);
  const [busy, setBusy] = useState(false);
  const phoneRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const st = (await fetch("/api/bot/status").then((r) =>
        r.json(),
      )) as SessionUi;
      let qrDataUrl: string | null = null;
      let pairingCode: string | null = null;

      if (st.status === "qr" || st.hasQr) {
        const qr = await fetch("/api/bot/qr").then((r) => r.json());
        qrDataUrl =
          typeof qr.qrDataUrl === "string" ? qr.qrDataUrl : null;
      }
      if (
        st.status === "qr" ||
        st.hasPairingCode ||
        st.status === "connecting"
      ) {
        const codeRes = await fetch("/api/bot/pairing-code").then((r) =>
          r.json(),
        );
        pairingCode =
          typeof codeRes.code === "string" ? codeRes.code : null;
      }

      setSession({
        ...st,
        qrDataUrl,
        pairingCode: pairingCode ?? st.pairingCode ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar sessão");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const boot = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(boot);
  }, [load]);

  useEffect(() => {
    if (session?.status === "connected") return;
    const t = setInterval(() => {
      void load();
    }, 4000);
    return () => clearInterval(t);
  }, [load, session?.status]);

  async function onPair(e: FormEvent) {
    e.preventDefault();
    setPairing(true);
    setError(null);
    try {
      const res = await fetch("/api/bot/pair", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: phoneInput }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : `Erro ${res.status}`,
        );
        return;
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao parear");
    } finally {
      setPairing(false);
    }
  }

  async function onLogout() {
    if (
      !window.confirm(
        "Isso desvincula o WhatsApp e exige novo pareamento. Continuar?",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bot/logout", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : `Erro ${res.status}`,
        );
        return;
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao desconectar");
    } finally {
      setBusy(false);
    }
  }

  async function onReconnect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bot/reconnect", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 || data.needsPairing) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "Pareie o número de novo",
        );
        phoneRef.current?.focus();
        await load();
        return;
      }
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : `Erro ${res.status}`,
        );
        return;
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao reconectar");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !session) {
    return <p className="text-sm text-slate-500">Carregando sessão…</p>;
  }

  const status = session?.status ?? "disconnected";
  const showForm = needsPairForm(status);
  const showPairingArtifacts =
    status === "qr" ||
    status === "connecting" ||
    Boolean(session?.qrDataUrl) ||
    Boolean(session?.pairingCode);
  const offline = isWorkerOfflineError(error || session?.lastError);
  const pairDisabled = pairing || busy || offline || !phoneInput.trim();
  const expiredArtifacts =
    (status === "qr" || status === "waiting_pairing") &&
    !session?.pairingCode &&
    !session?.qrDataUrl &&
    !offline;

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-slate-900">
            Sessão Baileys
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <SessionBadge status={status} />
            <span>
              {session?.canDispatch
                ? "pronto para disparo"
                : "envios pausados"}
            </span>
            {status === "connected" && session?.phone ? (
              <span className="font-mono text-slate-800">
                {maskPhone(session.phone)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {status === "connected" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onLogout()}
              className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Desconectar
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || offline}
              onClick={() => void onReconnect()}
              title={offline ? "Worker inacessível" : undefined}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              Reconectar
            </button>
          )}
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Atualizar
          </button>
        </div>
      </div>

      {offline ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          Worker inacessível — verifique o serviço Baileys (
          <code className="text-xs">WORKER_BASE_URL</code>).
        </p>
      ) : null}

      {status === "logged_out" ? (
        <p className="text-sm text-amber-800" role="status">
          Sessão encerrada no aparelho — pareie de novo.
        </p>
      ) : null}

      {(error || session?.lastError) && !offline ? (
        <p className="text-sm text-red-600" role="alert">
          {error || session?.lastError}
        </p>
      ) : null}

      {expiredArtifacts ? (
        <p className="text-sm text-slate-500">
          Código/QR expirado — gere novamente.
        </p>
      ) : null}

      {showForm && (
        <form
          onSubmit={onPair}
          className="space-y-3 border-t border-slate-100 pt-3"
        >
          <label
            className="block text-sm font-medium text-slate-700"
            htmlFor="wa-phone"
          >
            WhatsApp disparador
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              ref={phoneRef}
              id="wa-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(11) 99999-9999"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              className="min-w-[12rem] flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm"
              required
              disabled={offline}
            />
            <button
              type="submit"
              disabled={pairDisabled}
              title={offline ? "Worker inacessível" : undefined}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {pairing ? "Gerando…" : "Gerar código"}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Informe o número com DDD. Usamos o código de 8 dígitos e/ou o QR no
            aparelho.
          </p>
        </form>
      )}

      {showPairingArtifacts && (
        <div className="space-y-3 border-t border-slate-100 pt-3">
          <p className="text-sm text-slate-600">
            No celular:{" "}
            <strong>
              WhatsApp → Aparelhos conectados → Conectar um aparelho
            </strong>{" "}
            → use o código abaixo ou escaneie o QR.
          </p>
          {session?.pairingCode ? (
            <div className="rounded-md bg-blue-50 px-4 py-3 text-center ring-1 ring-blue-100">
              <p className="text-xs font-medium uppercase tracking-wide text-blue-800">
                Código de pareamento
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.25em] text-blue-950">
                {session.pairingCode}
              </p>
            </div>
          ) : status === "qr" || status === "connecting" ? (
            <p className="text-sm text-slate-500">
              Aguardando código… (atualiza automaticamente)
            </p>
          ) : null}
          {session?.qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.qrDataUrl}
              alt="QR code WhatsApp para pareamento"
              className="mx-auto h-48 w-48 rounded border border-slate-200"
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
