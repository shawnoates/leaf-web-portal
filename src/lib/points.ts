// Leaf points, phase 1 (collect and show). The server owns the rules
// (leaflets-server/cloud/points-rules.js); this file only carries the shapes it
// returns. Point amounts themselves are never hardcoded in the clients.

export interface PointsRow {
  id: string;
  kind: "attend" | "host" | "chat" | "share" | "ticket" | "ticket_reversed";
  delta: number;
  planTitle: string | null;
  businessName: string | null;
  visitNumber: number | null;
  createdAt: string | null;
}

export interface PointsBusiness {
  id: string;
  name: string;
  visits: number;
  nextWorth: number;
  regular: boolean;
}

export interface PointsUnseen extends PointsRow {
  nextWorth: number | null;
  /** The very first award: show the full "what are points" sheet. */
  first: boolean;
}

export interface PointsSummary {
  balance: number;
  monthEarned: number;
  businesses: PointsBusiness[];
  recent: PointsRow[];
  unseen: PointsUnseen[];
}

/** "Visit 3 at Still Studio" / "You hosted Thursday run". */
export function awardLine(r: PointsRow): string {
  if (r.kind === "host") return `You hosted ${r.planTitle || "a plan"}`;
  if (r.kind === "chat") return `Chatted in ${r.planTitle || "a plan"}`;
  if (r.kind === "share") return `A friend followed ${r.businessName || "the calendar"} from your link`;
  if (r.kind === "ticket") return `Your spot at ${r.planTitle || "a plan"}`;
  if (r.kind === "ticket_reversed") return `Refunded: ${r.planTitle || "a plan"}`;
  const where = r.businessName || r.planTitle || "this plan";
  return r.visitNumber ? `Visit ${r.visitNumber} at ${where}` : `Went to ${where}`;
}

/** The line under a row that already shows the plan title: no repeat of it. */
export function awardDetail(r: PointsRow): string {
  if (r.kind === "host") return "You hosted";
  if (r.kind === "chat") return "Chat bonus";
  if (r.kind === "share") return "Friend followed from your link";
  if (r.kind === "ticket") return "Your spot";
  if (r.kind === "ticket_reversed") return "Refunded";
  const where = r.businessName || "this plan";
  return r.visitNumber ? `Visit ${r.visitNumber} at ${where}` : `Went to ${where}`;
}
