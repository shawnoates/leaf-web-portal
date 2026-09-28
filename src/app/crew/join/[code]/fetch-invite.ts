import Parse from "@/lib/parse";

/** What a crew's invite link shows before anyone signs in (getCrewInvite). */
export type CrewInvitePreview = {
  name: string;
  ownerName: string;
  rhythmDays: number;
  oneTime?: boolean;
  joined: number;
  full: boolean;
};

// Server-side read for the page's metadata and its opengraph-image, so a
// shared invite link unfurls as the crew, not the generic site card.
export async function fetchCrewInvite(code: string): Promise<CrewInvitePreview | null> {
  try {
    const r = (await Parse.Cloud.run("getCrewInvite", { code })) as CrewInvitePreview;
    return r || null;
  } catch (err) {
    console.error("[/crew/join/:code] getCrewInvite failed:", err);
    return null;
  }
}

/** First name only: the preview travels further than the page. */
export function firstName(full: string): string {
  return (full || "").trim().split(/\s+/)[0] || "A friend";
}

export function paceLabel(i: Pick<CrewInvitePreview, "rhythmDays" | "oneTime">): string {
  if (i.oneTime) return "One night out";
  const labels: Record<number, string> = {
    7: "Every week", 14: "Every 2 weeks", 21: "Every 3 weeks", 28: "Every month", 42: "Every 6 weeks", 56: "Every 2 months",
  };
  return labels[i.rhythmDays] || `Every ${Math.round(i.rhythmDays / 7)} weeks`;
}
