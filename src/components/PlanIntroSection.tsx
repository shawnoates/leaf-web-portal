"use client";

/**
 * The host's 30-second hello, inside the dashboard's plan modal.
 *
 * One call to `getPlanIntroVideo` decides what this viewer is to the plan:
 *   - the host (by any of their ids, twin included) gets the recorder card;
 *   - the calendar owner, or an admin, sees a follower-host's live take with
 *     a way to pull it — it is their page;
 *   - anyone else, or a roster-hosted plan (those record from the offer
 *     page), gets nothing.
 * The server answers with a 403 for the cases that are nobody's business
 * here, which this treats as "render nothing" rather than an error.
 */

import { useCallback, useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import HlsVideo from "@/components/HlsVideo";
import HostIntroVideoCard, { type IntroVideoInfo } from "@/components/HostIntroVideoCard";
import { introVideoFrame } from "@/lib/intro-video-frame";

type IntroState = {
  actor: "host" | "owner" | "admin";
  canRecord: boolean;
  hostName: string | null;
  video: IntroVideoInfo;
};

export default function PlanIntroSection({
  eventGroupId,
  hostName,
  planStarted,
}: {
  eventGroupId: string;
  /** The name on the "Hosted by" line, for the owner's view. */
  hostName: string;
  planStarted: boolean;
}) {
  const [state, setState] = useState<IntroState | null>(null);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = (await Parse.Cloud.run("getPlanIntroVideo", { eventGroupId })) as IntroState;
      setState(r);
    } catch {
      setHidden(true);
    }
  }, [eventGroupId]);

  // Deferred a tick: the fetch resolves into setState from a callback, not
  // from the effect body itself (react-hooks/set-state-in-effect).
  useEffect(() => {
    const t = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(t);
  }, [load]);

  if (hidden || !state || !state.video.available) return null;

  if (state.actor === "host") {
    return (
      <HostIntroVideoCard
        source={{ kind: "plan", eventGroupId }}
        video={state.video}
        timeZone={null}
        planStarted={planStarted || state.video.planStarted === true}
        onChanged={load}
        embedded
      />
    );
  }

  // Owner / admin: only a live take is worth a block.
  const v = state.video;
  if (v.status !== "ready" || !v.url) return null;
  const who = state.hostName || hostName;

  const pull = async () => {
    setError(null);
    try {
      await Parse.Cloud.run("removePlanIntroVideo", { eventGroupId, reason: "Removed by the calendar owner" });
      setConfirm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove it.");
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap gap-4">
        <div className={introVideoFrame(v.aspectRatio).className} style={introVideoFrame(v.aspectRatio).style}>
          <HlsVideo src={v.url} poster={v.posterUrl} preload="none" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1 text-[14px] text-zinc-600">
          <p className="font-medium text-zinc-900">{who}&rsquo;s 30-second hello is on the plan page.</p>
          <p className="mt-1">Recorded by the host. It plays on the calendar page and the plan&rsquo;s link.</p>
          {error && <p className="mt-2 text-red-700">{error}</p>}
          <div className="mt-3">
            {confirm ? (
              <span className="flex flex-wrap items-center gap-3">
                <span>Take it off the page? {who} will be told.</span>
                <button type="button" onClick={pull} className="font-medium text-red-700 underline">Yes, remove</button>
                <button type="button" onClick={() => setConfirm(false)} className="font-medium text-zinc-600 underline">Keep it</button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirm(true)} className="font-medium text-zinc-500 underline">
                Remove it from the page
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
