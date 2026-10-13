"use client";

/**
 * "Say hello": a business records or uploads a 30-second hello from its Leaf
 * page. It plays as the host intro on every night the business runs itself
 * (offer-merchant-video-functions). Same recorder and uploader as the host
 * pages; hidden when video uploads aren't available.
 */

import { useCallback, useEffect, useState } from "react";
import { linkedHere } from "./ui";
import HostIntroVideoCard, { type IntroVideoInfo } from "@/components/HostIntroVideoCard";
import { merchantRun } from "@/lib/merchant-session";

export default function MerchantHello({
  token,
  inline = false,
  compact = false,
}: {
  token: string;
  /** Inside the Coming up card: a section under the nights, not a card of its own. */
  inline?: boolean;
  /** A row in the Get more neighbors card: one line, and the recorder opens on tap. */
  compact?: boolean;
}) {
  const [video, setVideo] = useState<IntroVideoInfo | null>(null);
  const [open, setOpen] = useState(() => linkedHere("hello"));

  const fetchVideo = useCallback(
    (): Promise<IntroVideoInfo | null> =>
      merchantRun<{ video: IntroVideoInfo }>("getMerchantIntroVideo", { token })
        .then((r) => r.video)
        .catch(() => null),
    [token],
  );
  // The card re-fetches after an upload, and every few seconds while processing.
  const load = useCallback(async () => setVideo(await fetchVideo()), [fetchVideo]);

  useEffect(() => {
    let alive = true;
    fetchVideo().then((v) => alive && setVideo(v));
    return () => {
      alive = false;
    };
  }, [fetchVideo]);

  if (!video || !video.available) return null;
  const body = (
    <div className="mt-3">
      <HostIntroVideoCard source={{ kind: "merchant", token }} video={video} timeZone={null} planStarted={false} onChanged={load} scriptCollapsed />
    </div>
  );
  if (compact) {
    const has = video.status === "ready" || video.status === "processing";
    return (
      <div id="hello" className="scroll-mt-6">
        <div className="flex items-start gap-3">
          {/* Their take's poster once they have one; until then the animated example (a still for reduced motion). */}
          {has && video.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={video.posterUrl} alt="" className="h-24 w-[4.5rem] shrink-0 rounded-xl object-cover" />
          ) : (
            <picture className="shrink-0">
              <source media="(prefers-reduced-motion: reduce)" srcSet="/host-intro-hero.jpg" />
              <source type="image/webp" srcSet="/host-intro-hero.webp" />
              <img src="/host-intro-hero.jpg" alt="" width={400} height={500} loading="lazy" decoding="async" className="h-24 w-[4.5rem] rounded-xl object-cover" />
            </picture>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-[17px] font-semibold text-stone-900">{has ? "Your 30-second hello" : "Add a 30-second hello"}</h3>
            <p className="mt-0.5 text-[14px] leading-snug text-stone-600">
              {has
                ? video.status === "processing"
                  ? "Processing. It plays on each Neighbor Hour plan we make."
                  : "It plays on each Neighbor Hour plan we make."
                : "We attach it to each Neighbor Hour plan. People RSVP to a face."}
            </p>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className={`mt-2 h-10 rounded-xl px-4 text-[14px] font-semibold ${open ? "border border-stone-300 text-stone-700" : "bg-leaf-800 text-white"}`}
            >
              {open ? "Close" : has ? "See it" : "Record it"}
            </button>
          </div>
        </div>
        {open && body}
      </div>
    );
  }
  if (inline) {
    return (
      <div id="hello" className="mt-5 scroll-mt-6 border-t border-stone-200 pt-5">
        <h3 className="text-[17px] font-semibold text-stone-900">Say hello to your neighbors</h3>
        {body}
      </div>
    );
  }
  return (
    <section id="hello" className="scroll-mt-6 rounded-3xl bg-white p-5 shadow-sm">
      <h2 className="font-fm-serif text-[26px] leading-tight text-stone-900">Say hello to your neighbors</h2>
      {body}
    </section>
  );
}
