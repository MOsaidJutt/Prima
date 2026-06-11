// Fixed PKR/USD conversion used for Stripe charges, since Prima's plans and
// top-up packs are priced in PKR but Stripe settles international cards in
// USD. In production this should be replaced with a live FX rate lookup.
// Deviation: documented in the Phase 6 summary.
export const PKR_PER_USD = 280

export function pkrToUsdCents(amountPkr: number): number {
  return Math.round((amountPkr / PKR_PER_USD) * 100)
}
