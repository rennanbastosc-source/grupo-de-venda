import type { Scraper } from "./types";

/** Typed stubs — implement when needed. */
export const magaluScraper: Scraper = {
  source: "magalu",
  async fetchOffers() {
    return [];
  },
};
