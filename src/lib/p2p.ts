// Peer-to-peer plan payments, as plan payloads describe them (server:
// cloud/p2p-payment.js). A plan collects either a fixed price per spot
// (`p2pAmountCents`, also the share once a split locks) or, before a split
// locks, a total divided by however many come (`p2pSplit`).

export type P2pSplitSummary = {
  totalCents: number;
  minHeadcount: number;
  maxHeadcount: number;
  hostInSplit: boolean;
  lowCents: number;
  highCents: number;
};

export function p2pMoney(cents: number): string {
  const d = cents / 100;
  return `$${Number.isInteger(d) ? d : d.toFixed(2)}`;
}

/** Does this plan ask guests to pay the host? */
export function collectsMoney(amountCents: number | null | undefined, split: P2pSplitSummary | null | undefined): boolean {
  return (amountCents ?? 0) > 0 || Boolean(split);
}

/** The line on an RSVP form telling a guest what they're signing up to pay. */
export function p2pPriceLine(amountCents: number | null | undefined, split: P2pSplitSummary | null | undefined): string | null {
  if (split) {
    return `Splitting ${p2pMoney(split.totalCents)} between ${split.minHeadcount}–${split.maxHeadcount} people: `
      + `${p2pMoney(split.lowCents)}–${p2pMoney(split.highCents)} each, paid to the host once the headcount is set. `
      + "Your spot is held until then.";
  }
  if ((amountCents ?? 0) > 0) {
    return `${p2pMoney(amountCents!)} per spot, paid to the host directly. Your spot is held while you pay.`;
  }
  return null;
}

export function parseP2pSplit(v: unknown): P2pSplitSummary | null {
  if (!v || typeof v !== "object") return null;
  const s = v as Record<string, unknown>;
  return typeof s.totalCents === "number" ? (s as unknown as P2pSplitSummary) : null;
}
