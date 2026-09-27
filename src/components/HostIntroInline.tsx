"use client";

/**
 * A host's hello played in place — the detail sheet's host block, the plan
 * page's host block — with its watch measured.
 *
 * Its whole job is to own one `useHostVideoTracking` per mounted video.
 * Calling the hook from a page that swaps between plans would carry one
 * plan's accumulated seconds into the next, and the summary would never
 * fire on close because the page itself never unmounts. Mounting it per
 * video makes closing the sheet the teardown that sends the summary.
 *
 * Deliberately NOT used where a host reviews their own take (the offer
 * card, the dashboard's plan section): those are the person who made it
 * checking it, and counting them as audience would inflate every number.
 */

import HlsVideo from "@/components/HlsVideo";
import { useHostVideoTracking, type HostVideoBy } from "@/lib/host-video-track";

export default function HostIntroInline({
  src,
  poster,
  className,
  planId,
  by,
  surface,
  calendarId,
}: {
  src: string;
  poster: string | null;
  className?: string;
  planId: string | null | undefined;
  by: HostVideoBy;
  /** Where it was watched: "sheet" | "plan_page". */
  surface: string;
  calendarId?: string | null;
}) {
  const measure = useHostVideoTracking({ planId, by, surface, calendarId });
  return (
    <HlsVideo
      src={src}
      poster={poster}
      preload="none"
      className={className}
      onTimeUpdate={measure.onTimeUpdate}
      onPlayingChange={measure.onPlayingChange}
      onEnded={measure.onEnded}
    />
  );
}
