const labels: Record<string, string> = {
  disconnected: "Desconectado",
  waiting_pairing: "Aguardando pareamento",
  qr: "Aguardando QR / código",
  connecting: "Conectando",
  connected: "Conectado",
  logged_out: "Sessão encerrada",
};

function tone(status: string): "ok" | "info" | "warn" | "danger" {
  if (status === "connected") return "ok";
  if (status === "connecting" || status === "qr") return "info";
  if (status === "waiting_pairing") return "warn";
  return "danger";
}

const styles = {
  ok: "bg-lime text-ink border-ink",
  info: "bg-purple text-white border-ink",
  warn: "bg-[#fef3c7] text-[#92400e] border-ink",
  danger: "bg-[#ffe4e6] text-danger border-danger",
} as const;

const dots = {
  ok: "bg-ok",
  info: "bg-lime",
  warn: "bg-warn",
  danger: "bg-danger",
} as const;

export function SessionBadge({ status }: { status: string }) {
  const t = tone(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 border-2 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide shadow-brutal-sm ${styles[t]}`}
    >
      <span className={`h-2 w-2 border border-ink ${dots[t]}`} aria-hidden />
      {labels[status] ?? status}
    </span>
  );
}
