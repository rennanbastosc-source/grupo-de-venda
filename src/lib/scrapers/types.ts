export type ScrapeSource =
  | "mercadolivre"
  | "amazon"
  | "shopee"
  | "magalu"
  | "manual";

export type OfferStatus = "new" | "approved" | "rejected" | "sent";

export type RawOffer = {
  title: string;
  url: string;
  priceCents?: number;
  originalPriceCents?: number;
  imageUrl?: string;
  externalId?: string;
};

export type NormalizedOffer = RawOffer & {
  source: ScrapeSource;
  urlCanonical: string;
};

export type Scraper = {
  source: Exclude<ScrapeSource, "manual">;
  fetchOffers: () => Promise<RawOffer[]>;
};
