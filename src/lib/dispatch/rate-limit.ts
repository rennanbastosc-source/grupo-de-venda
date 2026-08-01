export type RateSettings = {
  daily_cap: number;
  hourly_cap: number;
  min_interval_sec: number;
  sleep_start?: string | null;
  sleep_end?: string | null;
};

export type RateCounts = {
  daily: number;
  hourly: number;
  lastSentAt: Date | null;
};

export type RateDecision =
  | { ok: true }
  | { ok: false; reason: string };

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseHhMm(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = HHMM_RE.exec(value.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Minutos desde meia-noite em America/Sao_Paulo. */
function localMinutesSp(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const minute = Number(parts.find((p) => p.type === "minute")?.value);
  // en-GB + hour12:false pode devolver "24" à meia-noite em alguns engines
  const h = hour === 24 ? 0 : hour;
  return h * 60 + minute;
}

/**
 * true se `now` (qualquer fuso) cai dentro da janela de descanso
 * configurada em horário local de São Paulo.
 */
export function isWithinSleepWindow(
  now: Date,
  settings: RateSettings,
): boolean {
  const start = parseHhMm(settings.sleep_start);
  const end = parseHhMm(settings.sleep_end);
  if (start === null || end === null) return false;
  if (start === end) return false;

  const cur = localMinutesSp(now);
  if (start < end) {
    // ex: 08:00–18:00
    return cur >= start && cur < end;
  }
  // cruza meia-noite: ex 22:00–07:00
  return cur >= start || cur < end;
}

export function canSendNow(
  counts: RateCounts,
  settings: RateSettings,
  now: Date = new Date(),
): RateDecision {
  if (isWithinSleepWindow(now, settings)) {
    const s = settings.sleep_start!.trim();
    const e = settings.sleep_end!.trim();
    return {
      ok: false,
      reason: `Janela de descanso (${s}–${e}) — sem disparos agora`,
    };
  }
  if (counts.daily >= settings.daily_cap) {
    return { ok: false, reason: `Teto diário (${settings.daily_cap}) atingido` };
  }
  if (counts.hourly >= settings.hourly_cap) {
    return {
      ok: false,
      reason: `Teto horário (${settings.hourly_cap}) atingido`,
    };
  }
  if (counts.lastSentAt) {
    const elapsed =
      (now.getTime() - counts.lastSentAt.getTime()) / 1000;
    if (elapsed < settings.min_interval_sec) {
      return {
        ok: false,
        reason: `Aguarde ${Math.ceil(settings.min_interval_sec - elapsed)}s (intervalo mínimo)`,
      };
    }
  }
  return { ok: true };
}
