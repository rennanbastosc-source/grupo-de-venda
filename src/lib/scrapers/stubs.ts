import type { Scraper } from "./types";

/** Typed stubs — implement when needed. */
export const shopeeScraper: Scraper = {
  source: "shopee",
  async fetchOffers() {
    return [];
  },
};

export const magaluScraper: Scraper = {
  source: "magalu",
  async fetchOffers() {
    return [];
  },
};
