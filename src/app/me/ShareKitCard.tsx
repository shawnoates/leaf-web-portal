"use client";

import { COPY } from "./shareKitCopy";
import { ShareKitRows, ShareKitStyles, useShareKit } from "@/components/ShareKit";

// The getMeDashboard prompt payload. The key stays `building_intro` — that's
// the server's name for the eligibility row this card reads and writes.
export interface ShareKitMePrompt {
  key: "building_intro";
  calendarId: string | null;
  calendarName: string;
  shareId: string | null;
  preview?: boolean;
}

/**
 * /me share kit (handoff turn 5): the dashed card in the "Your neighborhood
 * calendar" slot. Headline on the left, the four notes as compact rows in a
 * 2×2 grid on the right; an open row spans both columns.
 */
export default function ShareKitCard({ prompt, firstName }: { prompt: ShareKitMePrompt; firstName: string }) {
  const kit = useShareKit({
    payload: { calendarId: prompt.calendarId, calendarName: prompt.calendarName, shareId: prompt.shareId },
    firstName,
    surface: "me_card",
    preview: prompt.preview === true,
  });

  return (
    <section className="sk sk-card" aria-label={COPY.headline}>
      <ShareKitStyles />
      <div className="eyebrow">{prompt.calendarName || COPY.eyebrow}</div>
      <div className="sk-grid">
        <div>
          <h3 className="sk-h">{COPY.headline}</h3>
          <p className="sk-intro">{COPY.introMe}</p>
        </div>
        <ShareKitRows kit={kit} compact />
      </div>
    </section>
  );
}
