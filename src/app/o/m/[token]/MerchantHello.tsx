"use client";

/**
 * "Say hello": a business records or uploads a 30-second hello from its Leaf
 * page. It plays as the host intro on every night the business runs itself
 * (offer-merchant-video-functions). Same recorder and uploader as the host
 * pages; hidden when video uploads aren't available.
 */

import { useCallback, useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import HostIntroVideoCard, { type IntroVideoInfo } from "@/components/HostIntroVideoCard";

export default function MerchantHello({ token }: { token: string }) {
  const [video, setVideo] = useState<IntroVideoInfo | null>(null);

  const fetchVideo = useCallback(
    (): Promise<IntroVideoInfo | null> =>
      Parse.Cloud.run("getMerchantIntroVideo", { token })
        .then((r: { video: IntroVideoInfo }) => r.video)
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
  return (
    <section id="hello" className="scroll-mt-6 rounded-3xl bg-white p-5 shadow-sm">
      <h2 className="font-fm-serif text-[26px] leading-tight text-stone-900">Say hello to your neighbors</h2>
      <p className="mt-1 text-[15px] text-stone-600">One hello plays on every night you host.</p>
      <div className="mt-3">
        <HostIntroVideoCard source={{ kind: "merchant", token }} video={video} timeZone={null} planStarted={false} onChanged={load} embedded scriptCollapsed />
      </div>
    </section>
  );
}
