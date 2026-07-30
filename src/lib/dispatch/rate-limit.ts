export type RateSettings = {
  daily_cap: number;
  hourly_cap: number;
  min_interval_sec: number;
};

export type RateCounts = {
  daily: number;
  hourly: number;
  lastSentAt: Date | null;
};

export type RateDecision =
  | { ok: true }
  | { ok: false; reason: string };

export function canSendNow(
  counts: RateCounts,
  settings: RateSettings,
  now: Date = new Date(),
): RateDecision {
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
