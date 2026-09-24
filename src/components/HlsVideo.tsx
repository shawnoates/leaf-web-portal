"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A Mux HLS stream in a plain <video>. Safari plays HLS natively; everything
 * else gets hls.js, loaded only when needed. When playback can't be set up
 * the poster stays as a plain image, so the layout never collapses.
 *
 * Shared by the plan hero (/p/<id>), the host intro on the org page and the
 * accept page's preview — one place for the Safari/hls.js split.
 */
export default function HlsVideo({
  src,
  poster,
  className = "",
  preload = "metadata",
  controls = true,
  autoPlay = false,
  muted = false,
  onUnplayable,
}: {
  src: string;
  poster: string | null;
  className?: string;
  preload?: "none" | "metadata" | "auto";
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  onUnplayable?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playable, setPlayable] = useState(true);

  useEffect(() => {
    const video = ref.current;
    if (!video || !src) return;
    setPlayable(true);
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
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
        instance.loadSource(src);
        instance.attachMedia(video);
      })
      .catch(() => setPlayable(false));
    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [src]);

  useEffect(() => {
    if (!playable) onUnplayable?.();
  }, [playable, onUnplayable]);

  if (!playable) {
    if (poster) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={poster} alt="" className={className} />;
    }
    return <div className={className} />;
  }

  return (
    <video
      ref={ref}
      poster={poster ?? undefined}
      controls={controls}
      autoPlay={autoPlay}
      muted={muted}
      playsInline
      preload={preload}
      className={className}
    />
  );
}
