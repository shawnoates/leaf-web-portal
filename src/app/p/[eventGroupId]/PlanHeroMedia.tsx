"use client";

import { useEffect, useRef, useState } from "react";

// The card's hero: the invitation video when there is one, the image
// otherwise. The video is a Mux HLS stream — Safari plays those natively;
// everything else gets hls.js, loaded only when needed. The poster is the
// same clean frame the Home card and the share card use, so nothing here
// shows the play-button-burned-in thumbnail that `image` carries for
// imported plans. If playback can't be set up, the poster stays as a
// plain image.
export default function PlanHeroMedia({
  image,
  videoUrl,
}: {
  image: string | null;
  videoUrl: string | null;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playable, setPlayable] = useState(Boolean(videoUrl));

  useEffect(() => {
    const video = ref.current;
    if (!video || !videoUrl) return;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = videoUrl;
      return;
    }
    let cancelled = false;
    let hls: { destroy: () => void } | null = null;
    import("hls.js")
      .then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) {
          setPlayable(false);
          return;
        }
        const instance = new Hls();
        hls = instance;
        instance.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) setPlayable(false);
        });
        instance.loadSource(videoUrl);
        instance.attachMedia(video);
      })
      .catch(() => setPlayable(false));
    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [videoUrl]);

  if (videoUrl && playable) {
    return (
      <div className="w-full aspect-[4/3] bg-zinc-900">
        <video
          ref={ref}
          poster={image ?? undefined}
          controls
          playsInline
          preload="metadata"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }
  if (image) {
    return (
      <div
        className="w-full aspect-[4/3] bg-zinc-200 bg-cover bg-center"
        style={{ backgroundImage: `url(${image})` }}
      />
    );
  }
  return <div className="w-full aspect-[4/3] bg-zinc-200" />;
}
