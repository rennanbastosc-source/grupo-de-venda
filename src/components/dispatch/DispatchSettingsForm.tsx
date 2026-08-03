"use client";

import type { FormEvent } from "react";

export type DispatchSettings = {
  daily_cap: number;
  hourly_cap: number;
  min_interval_sec: number;
  daily_offer_cap: number;
  message_template: string;
  auto_dispatch_enabled: boolean;
  auto_dispatch_group_ids: string[];
  default_affiliate_provider_id: string | null;
};

export type GroupOption = {
  id: string;
  name: string;
  active: boolean;
  jid: string;
};

export type ProviderOption = { id: string; name: string; active: boolean };

type Props = {
  settings: DispatchSettings | null;
  groups: GroupOption[];
  providers: ProviderOption[] | null;
  offerCap: string;
  dailyCap: string;
  hourlyCap: string;
  intervalSec: string;
  messageTemplate: string;
  autoEnabled: boolean;
  autoGroupIds: string[];
  defaultProviderId: string;
  busy: boolean;
  onOfferCap: (v: string) => void;
  onDailyCap: (v: string) => void;
  onHourlyCap: (v: string) => void;
  onIntervalSec: (v: string) => void;
  onMessageTemplate: (v: string) => void;
  onAutoEnabled: (v: boolean) => void;
  onToggleAutoGroup: (id: string) => void;
  onDefaultProviderId: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
};

export function DispatchSettingsForm({
  settings,
  groups,
  providers,
  offerCap,
  dailyCap,
  hourlyCap,
  intervalSec,
  messageTemplate,
  autoEnabled,
  autoGroupIds,
  defaultProviderId,
  busy,
  onOfferCap,
  onDailyCap,
  onHourlyCap,
  onIntervalSec,
  onMessageTemplate,
  onAutoEnabled,
  onToggleAutoGroup,
  onDefaultProviderId,
  onSubmit,
}: Props) {
  return (
    <form
      onSubmit={onSubmit}
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
          onChange={(e) => onOfferCap(e.target.value)}
          className="b-input"
        />
      </label>
      <label className="block text-sm">
        <span className="b-label">Daily cap</span>
        <input
          type="number"
          min={1}
          value={dailyCap}
          onChange={(e) => onDailyCap(e.target.value)}
          className="b-input"
        />
      </label>
      <label className="block text-sm">
        <span className="b-label">Hourly cap</span>
        <input
          type="number"
          min={1}
          value={hourlyCap}
          onChange={(e) => onHourlyCap(e.target.value)}
          className="b-input"
        />
      </label>
      <label className="block text-sm">
        <span className="b-label">Intervalo (s)</span>
        <input
          type="number"
          min={1}
          value={intervalSec}
          onChange={(e) => onIntervalSec(e.target.value)}
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
            onChange={(e) => onMessageTemplate(e.target.value)}
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
            onChange={(e) => onAutoEnabled(e.target.checked)}
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
                    onChange={() => onToggleAutoGroup(g.id)}
                  />
                  <span>
                    {g.name}{" "}
                    <span className="font-mono text-xs text-muted">{g.jid}</span>
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
              onChange={(e) => onDefaultProviderId(e.target.value)}
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
  );
}
