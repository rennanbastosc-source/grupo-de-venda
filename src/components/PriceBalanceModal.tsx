"use client";

import { useEffect } from "react";

type Offer = {
  id: string;
  title: string;
  source: string;
  price_cents: number | null;
  original_price_cents?: number | null;
  status: string;
  caption_status?: string | null;
  caption_error?: string | null;
  caption?: string | null;
  url: string;
  scraped_at: string;
};

type PriceBalanceModalProps = {
  offer: Offer | null;
  onClose: () => void;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onEmitAffiliate: (id: string) => Promise<void>;
};

function formatPrice(cents: number | null | undefined) {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function calculateSavings(priceCents: number | null, originalPriceCents?: number | null) {
  if (!priceCents || !originalPriceCents || originalPriceCents <= priceCents) {
    return null;
  }
  const savingsCents = originalPriceCents - priceCents;
  const discountPercent = Math.round((savingsCents / originalPriceCents) * 100);
  return { savingsCents, discountPercent };
}

function getSourceBadge(source: string) {
  switch (source) {
    case "mercadolivre":
      return "bg-[#fff059] text-ink";
    case "amazon":
      return "bg-[#ff9900] text-ink";
    case "shopee":
      return "bg-[#ee4d2d] text-white";
    case "magalu":
      return "bg-[#0086ff] text-white";
    default:
      return "bg-ice text-ink";
  }
}

export function PriceBalanceModal({
  offer,
  onClose,
  onApprove,
  onReject,
  onEmitAffiliate,
}: PriceBalanceModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!offer) return null;

  const savings = calculateSavings(offer.price_cents, offer.original_price_cents);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg border-[3px] border-ink bg-white p-6 shadow-brutal space-y-5 relative"
        role="dialog"
        aria-modal="true"
      >
        {/* Cabeçalho do Modal */}
        <div className="flex items-start justify-between gap-3 border-b-2 border-ink pb-3">
          <div>
            <span
              className={`inline-block border-[2px] border-ink px-2 py-0.5 text-[10px] font-black uppercase shadow-[2px_2px_0px_#000] ${getSourceBadge(
                offer.source,
              )}`}
            >
              {offer.source}
            </span>
            <h3 className="mt-2 text-lg font-black uppercase text-ink line-clamp-2">
              {offer.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="b-btn b-btn-ghost !px-2.5 !py-1 text-sm font-black"
            aria-label="Fechar modal"
          >
            ✕
          </button>
        </div>

        {/* Quadro Comparativo de Preço (Balanço) */}
        <div className="border-[3px] border-ink bg-ice/40 p-4 space-y-3">
          <p className="b-label text-xs">Balanço de Preço & Economia</p>

          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-xs text-muted font-bold">Preço de Lista (Original)</p>
              <p className="text-sm font-extrabold text-muted line-through">
                {formatPrice(offer.original_price_cents)}
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs text-ink font-bold">Preço Promocional Atual</p>
              <p className="text-2xl font-black text-ink">
                {formatPrice(offer.price_cents)}
              </p>
            </div>
          </div>

          {savings ? (
            <div className="flex items-center justify-between border-t-2 border-ink pt-3 mt-2">
              <span className="inline-block border-[2px] border-ink bg-lime px-3 py-1 text-xs font-black uppercase text-ink shadow-[2px_2px_0px_#000]">
                -{savings.discountPercent}% OFF
              </span>
              <p className="text-xs font-bold text-ink">
                Economia real de{" "}
                <span className="font-black text-ok">
                  {formatPrice(savings.savingsCents)}
                </span>
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted italic border-t-2 border-ink pt-2 mt-2">
              * Sem preço original capturado para comparativo de desconto percentual.
            </p>
          )}
        </div>

        {/* Caption (status + erro só no modal) */}
        <div className="border-[3px] border-ink bg-white p-4 space-y-2">
          <p className="b-label text-xs">Caption</p>
          <p className="text-xs font-black uppercase">
            status: {offer.caption_status ?? "none"}
          </p>
          {offer.caption_status === "ready" && offer.caption ? (
            <p className="text-sm font-medium text-ink whitespace-pre-wrap">
              {offer.caption}
            </p>
          ) : null}
          {offer.caption_status === "failed" && offer.caption_error ? (
            <p
              className="text-sm font-bold text-danger break-words"
              role="alert"
            >
              {offer.caption_error}
            </p>
          ) : null}
          {offer.caption_status === "failed" && !offer.caption_error ? (
            <p className="text-sm text-muted italic">
              Falhou sem motivo gravado (oferta anterior à coluna caption_error).
            </p>
          ) : null}
        </div>

        {/* Ações Rápidas da Oferta */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <a
            href={offer.url}
            target="_blank"
            rel="noreferrer"
            className="b-btn b-btn-ghost !py-1.5 !px-3 !text-xs"
          >
            Abrir Link Original ↗
          </a>

          <div className="flex flex-wrap items-center gap-2">
            {offer.status !== "approved" ? (
              <button
                type="button"
                className="b-btn !bg-lime !text-ink !px-3 !py-1.5 !text-xs shadow-[2px_2px_0px_#000]"
                onClick={() => void onApprove(offer.id)}
              >
                Aceitar
              </button>
            ) : null}
            {offer.status !== "rejected" ? (
              <button
                type="button"
                className="b-btn !bg-danger !text-white !px-3 !py-1.5 !text-xs shadow-[2px_2px_0px_#000]"
                onClick={() => void onReject(offer.id)}
              >
                Rejeitar
              </button>
            ) : null}
            <button
              type="button"
              className="b-btn b-btn-ghost !px-3 !py-1.5 !text-xs shadow-[2px_2px_0px_#000]"
              onClick={() => void onEmitAffiliate(offer.id)}
            >
              Gerar Afiliado
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
