const labels: Record<string, string> = {
  disconnected: "Desconectado",
  waiting_pairing: "Aguardando pareamento",
  qr: "Aguardando QR / código",
  connecting: "Conectando",
  connected: "Conectado",
  logged_out: "Sessão encerrada",
};

function tone(status: string): "green" | "blue" | "amber" | "red" {
  if (status === "connected") return "green";
  if (status === "connecting" || status === "qr") return "blue";
  if (status === "waiting_pairing") return "amber";
  return "red";
}

const styles = {
  green: "bg-green-50 text-green-800 ring-1 ring-green-200",
  blue: "bg-blue-50 text-blue-800 ring-1 ring-blue-200",
  amber: "bg-amber-50 text-amber-900 ring-1 ring-amber-200",
  red: "bg-red-50 text-red-800 ring-1 ring-red-200",
} as const;

const dots = {
  green: "bg-green-500",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
} as const;

export function SessionBadge({ status }: { status: string }) {
  const t = tone(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[t]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dots[t]}`} aria-hidden />
      {labels[status] ?? status}
    </span>
  );
}
