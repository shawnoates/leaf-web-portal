import Parse from "@/lib/parse";

/** What a crew's invite link shows before anyone signs in (getCrewInvite). */
export type CrewInvitePreview = {
  name: string;
  ownerName: string;
  rhythmDays: number;
  oneTime?: boolean;
  /** When the crew usually meets, if its name says ("09:00" for a morning crew). */
  usualTime?: string | null;
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

/** A morning or daytime crew isn't "nights" (5pm–4am is; unknown: night, as on the crew page). */
export function inviteIsEvening(i: Pick<CrewInvitePreview, "usualTime"> | null): boolean {
  const t = i?.usualTime;
  if (!t) return true;
  const h = Number(t.split(":")[0]);
  return !Number.isFinite(h) || h >= 17 || h < 4;
}

export function paceLabel(i: Pick<CrewInvitePreview, "rhythmDays" | "oneTime" | "usualTime">): string {
  if (i.oneTime) return inviteIsEvening(i) ? "One night out" : "One get-together";
  const labels: Record<number, string> = {
    7: "Every week", 14: "Every 2 weeks", 21: "Every 3 weeks", 28: "Every month", 42: "Every 6 weeks", 56: "Every 2 months",
  };
  return labels[i.rhythmDays] || `Every ${Math.round(i.rhythmDays / 7)} weeks`;
}
