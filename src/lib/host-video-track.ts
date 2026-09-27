"use client";

/**
 * Watch measurement for the host's 30-second hello.
 *
 * Two events per view, no more: `host_video_play` when it first starts, and
 * one `host_video_watched` summary when it ends or the player goes away.
 * A progress ping every few seconds would be easier and would also be the
 * thing that makes the event log unreadable — one row per view keeps the
 * table joinable to an RSVP.
 *
 * Watch time is summed from the gaps between timeupdate ticks rather than
 * read off `currentTime`, so a seek forward doesn't award seconds nobody
 * watched and a replay doesn't reset the total. A tick further apart than
 * `MAX_TICK_SEC` is a seek or a stall, and is dropped.
 *
 * What this cannot see: a tab closed mid-clip. React unmount fires when a
 * player is closed in-page, which is the common case, but a closed tab
 * takes the summary with it. Every watch number is therefore a floor.
 */

import { useCallback, useEffect, useRef } from "react";
import { track } from "@/lib/track";

/** Longer than this between ticks means a seek or a stall, not watching. */
const MAX_TICK_SEC = 2;
/** Under this and it was a misfire, not a view worth a row. */
const MIN_REPORTABLE_SEC = 1;
/** At or past this share of the clip counts as watched to the end. */
const COMPLETE_AT = 0.95;

export type HostVideoBy = "roster" | "host";

export function useHostVideoTracking({
  planId,
  by,
  surface,
  calendarId,
}: {
  planId: string | null | undefined;
  /** Who recorded it: a paid roster host, or the plan's own host. */
  by: HostVideoBy;
  /** Where it was watched: "card" | "sheet" | "plan_page" | "me". */
  surface: string;
  calendarId?: string | null;
}) {
  const started = useRef(false);
  const sent = useRef(false);
  const watched = useRef(0);
  const lastTick = useRef<number | null>(null);
  const maxPct = useRef(0);
  const ended = useRef(false);

  const base = useCallback(
    () => ({ planId: planId ?? "", by, surface }),
    [planId, by, surface],
  );

  /** The one summary. Safe to call repeatedly; only the first one sends. */
  const flush = useCallback(() => {
    if (sent.current || !planId) return;
    const secs = Math.round(watched.current);
    if (secs < MIN_REPORTABLE_SEC) return;
    sent.current = true;
    track(
      "host_video_watched",
      {
        ...base(),
        secs,
        pct: Math.round(Math.min(1, maxPct.current) * 100),
        completed: ended.current || maxPct.current >= COMPLETE_AT,
      },
      calendarId ?? null,
    );
  }, [base, calendarId, planId]);

  // The teardown summary. Also covers a viewer who navigates away in-app:
  // React unmounts the player either way.
  useEffect(() => () => flush(), [flush]);

  const onPlayingChange = useCallback(
    (playing: boolean) => {
      if (playing && !started.current && planId) {
        started.current = true;
        track("host_video_play", base(), calendarId ?? null);
      }
      // A pause breaks the tick chain; the next tick starts a fresh gap
      // rather than billing the time the video sat still.
      if (!playing) lastTick.current = null;
    },
    [base, calendarId, planId],
  );

  const onTimeUpdate = useCallback((current: number, duration: number) => {
    const prev = lastTick.current;
    lastTick.current = current;
    if (prev != null) {
      const delta = current - prev;
      if (delta > 0 && delta <= MAX_TICK_SEC) watched.current += delta;
    }
    if (duration > 0) {
      maxPct.current = Math.max(maxPct.current, Math.min(1, current / duration));
    }
  }, []);

  const onEnded = useCallback(() => {
    ended.current = true;
    maxPct.current = 1;
    flush();
  }, [flush]);

  return { onPlayingChange, onTimeUpdate, onEnded, flush };
}
