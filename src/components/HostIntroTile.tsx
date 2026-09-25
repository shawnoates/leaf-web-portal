"use client";

/**
 * The host's 30-second hello, on the plan card itself.
 *
 * Until now the video only existed inside the detail sheet, so most people
 * never saw it: the card's hints were a 10px play badge on the avatar and a
 * text link. This puts the host's face on the cover photo instead.
 *
 * Resting: a circle crop of the poster frame in the cover's bottom-left
 * corner, with a play badge and a caption pill. Playing: the tile opens into
 * a portrait player over the (blurred) cover, sound on, with the host's name
 * and bio beside it. Nothing outside the cover moves, so the card keeps its
 * shape. The tile stops its clicks so the cover's own click (open the
 * sheet) doesn't fire.
 *
 * Renders inside a `relative overflow-hidden` cover. The sheet's host block
 * stays as it was; this is the way in for people scrolling the calendar.
 */

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { Play, Volume2, VolumeX, X } from "lucide-react";
import HlsVideo from "@/components/HlsVideo";

export type HostIntro = {
  url: string;
  poster: string | null;
  /** Seconds, when the server sends it; the duration chip is hidden without it. */
  durationSec: number | null;
};

function clock(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function HostIntroTile({
  video,
  hostName,
  hostBio,
  hostAvatar,
  onWatched,
}: {
  video: HostIntro;
  hostName: string;
  hostBio: string | null;
  hostAvatar: string | null;
  /** Fired once, when most of the video has played. */
  onWatched?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState({ current: 0, duration: video.durationSec ?? 0 });
  const videoEl = useRef<HTMLVideoElement | null>(null);
  const watched = useRef(false);

  const poster = video.poster ?? hostAvatar;
  const stop = (e: MouseEvent) => e.stopPropagation();

  const close = useCallback(() => {
    setOpen(false);
    setPlaying(false);
    setTime({ current: 0, duration: video.durationSec ?? 0 });
  }, [video.durationSec]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const markWatched = () => {
    if (watched.current) return;
    watched.current = true;
    onWatched?.();
  };

  if (!open) {
    return (
      <button
        type="button"
        aria-label={`Play ${hostName}'s intro`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="absolute bottom-3 left-3 z-10 flex items-center gap-2.5 text-left md:bottom-4 md:left-4 md:gap-3"
      >
        <span className="relative block h-[88px] w-[88px] overflow-hidden rounded-full bg-zinc-900 shadow-[0_12px_28px_rgba(0,0,0,0.45)] ring-2 ring-white md:h-[120px] md:w-[120px]">
          {poster && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={poster} alt="" className="h-full w-full object-cover" />
          )}
          <span className="absolute left-1/2 top-1/2 flex h-[30px] w-[30px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow-md md:h-9 md:w-9">
            <Play className="ml-0.5 h-3 w-3 fill-zinc-900 text-zinc-900 md:h-3.5 md:w-3.5" />
          </span>
          {video.durationSec ? (
            <span className="absolute bottom-[7px] left-1/2 -translate-x-1/2 rounded-md bg-black/60 px-1.5 py-px text-[10px] font-semibold tabular-nums text-white md:bottom-2.5 md:text-[11px]">
              {clock(video.durationSec)}
            </span>
          ) : null}
        </span>
        <span className="flex flex-col gap-0.5 rounded-[10px] bg-zinc-900/80 px-2.5 py-1.5 text-white shadow-[0_8px_20px_rgba(0,0,0,0.3)] md:px-3 md:py-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/70 md:text-[10px]">
            Meet your host
          </span>
          <span className="whitespace-nowrap text-[13px] font-semibold md:text-sm">
            A quick hello from {hostName}
          </span>
        </span>
      </button>
    );
  }

  const pct = time.duration > 0 ? Math.min(100, (time.current / time.duration) * 100) : 0;

  return (
    // The cover photo stays underneath, blurred and dimmed; a click on it closes.
    <div
      className="absolute inset-0 z-10 cursor-default bg-black/55 backdrop-blur-xl"
      onClick={(e) => {
        e.stopPropagation();
        close();
      }}
    >
      <div className="absolute inset-3 flex items-end gap-4 md:inset-4">
        <div
          className="relative aspect-[9/16] h-full shrink-0 cursor-pointer overflow-hidden rounded-xl bg-black shadow-[0_16px_40px_rgba(0,0,0,0.5)] ring-2 ring-white"
          onClick={(e) => {
            e.stopPropagation();
            const v = videoEl.current;
            if (!v) return;
            if (v.paused) void v.play();
            else v.pause();
          }}
        >
          <HlsVideo
            src={video.url}
            poster={poster}
            preload="auto"
            autoPlay
            controls={false}
            muted={muted}
            className="h-full w-full object-cover"
            onVideoElement={(el) => {
              videoEl.current = el;
            }}
            onTimeUpdate={(current, duration) => {
              setTime({ current, duration });
              if (duration > 0 && current / duration >= 0.8) markWatched();
            }}
            onPlayingChange={setPlaying}
            onEnded={markWatched}
          />
          {!playing && (
            <span className="pointer-events-none absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow-md">
              <Play className="ml-0.5 h-4 w-4 fill-zinc-900 text-zinc-900" />
            </span>
          )}
          <button
            type="button"
            aria-label="Close"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/70"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
          <div
            className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2.5 pt-7 text-white"
            onClick={stop}
          >
            <div className="h-[3px] overflow-hidden rounded-sm bg-white/35">
              <div className="h-full bg-white" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex items-center justify-between text-[11px] font-semibold tabular-nums">
              <span>
                {clock(time.current)}
                {time.duration > 0 ? ` / ${clock(time.duration)}` : ""}
              </span>
              <button
                type="button"
                aria-label={muted ? "Unmute" : "Mute"}
                onClick={(e) => {
                  e.stopPropagation();
                  const next = !muted;
                  setMuted(next);
                  if (videoEl.current) videoEl.current.muted = next;
                }}
                className="-m-1 p-1"
              >
                {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1 pb-2 text-white" onClick={stop}>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/70">Your host</p>
          <p className="mt-1 text-2xl font-light tracking-tight md:text-[26px]">{hostName}</p>
          {hostBio && (
            <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-white/80 md:line-clamp-4">{hostBio}</p>
          )}
          <p className="mt-3 hidden text-xs text-white/60 md:block">Sound is on. Click anywhere else to close.</p>
        </div>
      </div>
    </div>
  );
}
