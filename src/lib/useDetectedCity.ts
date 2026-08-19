"use client";

import { useEffect, useState } from "react";
import {
  detectCity,
  primeGeoCity,
  GENERIC_CITY,
  type DetectedCity,
} from "@/lib/detectCity";

/**
 * The visitor's city, resolved in two beats:
 *
 *  1. On mount, the device timezone — instant, so the placeholder stops
 *     saying "your neighborhood" right away.
 *  2. When /api/geo answers, the CDN edge's view of where the request
 *     actually came from, which wins. Someone in Vancouver on a laptop
 *     still set to America/New_York flips from Fort Greene to Mount
 *     Pleasant here.
 *
 * `ready` means the edge has settled (answered, failed, or timed out) —
 * gate anything that sends coordinates to the server on it, otherwise the
 * first render's timezone guess is what generates the calendar.
 *
 * SSR renders GENERIC_CITY, matching detectCity()'s server behavior, so
 * hydration doesn't mismatch.
 */
export function useDetectedCity(): { city: DetectedCity; ready: boolean } {
  const [city, setCity] = useState<DetectedCity>(GENERIC_CITY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setCity(detectCity());

    primeGeoCity().then((geo) => {
      if (cancelled) return;
      if (geo) setCity(geo);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { city, ready };
}
