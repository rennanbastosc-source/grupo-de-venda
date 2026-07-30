const labels: Record<string, string> = {
  disconnected: "Desconectado",
  qr: "Aguardando QR",
  connecting: "Conectando",
  connected: "Conectado",
};

export function SessionBadge({ status }: { status: string }) {
  const ok = status === "connected";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        ok
          ? "bg-green-50 text-green-800 ring-1 ring-green-200"
          : "bg-red-50 text-red-800 ring-1 ring-red-200"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          ok ? "bg-green-500" : "bg-red-500"
        }`}
        aria-hidden
      />
      {labels[status] ?? status}
    </span>
  );
}
