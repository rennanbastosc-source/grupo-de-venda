import type { NormalizedOffer } from "./types";

/** Keep first occurrence per source+urlCanonical. */
export function dedupeOffers(offers: NormalizedOffer[]): NormalizedOffer[] {
  const seen = new Set<string>();
  const out: NormalizedOffer[] = [];
  for (const o of offers) {
    const key = `${o.source}::${o.urlCanonical}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(o);
  }
  return out;
}
