"use client";

import { useEffect } from "react";
import { COPY } from "@/app/me/shareKitCopy";
import { ShareKitRows, ShareKitStyles, Skyline, useShareKit, type ShareKitPayload } from "@/components/ShareKit";

export type { ShareKitPayload };

/**
 * Post-follow share kit (handoff turn 4): the modal / bottom sheet body shown
 * inside FollowModal once a public follow has landed. Requires a Parse
 * session — the caller adopts the OTP session before mounting this. "Maybe
 * later", the scrim, and Esc all close without recording an answer; the kit
 * resurfaces on /me.
 */
export default function ShareKitPrompt({
  payload,
  firstName,
  onDone,
}: {
  payload: ShareKitPayload;
  firstName: string;
  onDone: () => void;
}) {
  const kit = useShareKit({ payload, firstName, surface: "post_follow" });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onDone(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  return (
    <div className="sk sk-post">
      <ShareKitStyles />
      <div className="sk-band">
        <span className="sk-grip" aria-hidden />
        <Skyline />
      </div>
      <div className="sk-title">
        <div>
          <h3 className="sk-h">
            <span className="sk-h-m">{COPY.headlineLines[0]}<br />{COPY.headlineLines[1]}</span>
            <span className="sk-h-d">{COPY.headline}</span>
          </h3>
          <p className="sk-intro">{COPY.introPostFollow}</p>
        </div>
        <button type="button" className="sk-later top" onClick={onDone}>{COPY.maybeLater}</button>
      </div>
      <ShareKitRows kit={kit} />
      <div className="sk-foot">
        <button type="button" className="sk-later" onClick={onDone}>{COPY.maybeLater}</button>
      </div>
    </div>
  );
}
