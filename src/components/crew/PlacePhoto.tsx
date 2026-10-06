"use client";

import { useState, type ReactNode } from "react";
import Parse from "@/lib/parse-client";

/**
 * A place's photo that falls back to its letter tile when the image won't
 * load (an expired or moved photo URL), instead of the browser's broken-image
 * box. The first failure also asks the server to check the URL and fetch a
 * fresh photo for next time.
 */
export default function PlacePhoto({ src, locationId, fallback, className = "h-full w-full object-cover" }: {
  src: string | null | undefined;
  locationId?: string | null;
  fallback: ReactNode;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={className}
      onError={() => {
        setFailed(src);
        if (locationId) Parse.Cloud.run("reportBrokenPlacePhoto", { locationId, url: src }).catch(() => {});
      }}
    />
  );
}
