"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  detectCity,
  primeGeoCity,
  GENERIC_CITY,
  type DetectedCity,
} from "@/lib/detectCity";

// Where the visitor is, as a tiny external store rather than component
// state. Two reasons: every surface that asks (hero, prompt bar, gallery,
// generator) shares one answer and one /api/geo request, and
// useSyncExternalStore renders the server snapshot during hydration, so
// the timezone guess can be live from the first client render without a
// mismatch.

export interface CitySnapshot {
  city: DetectedCity;
  /** True once the edge has settled — answered, failed, or timed out.
   *  Gate anything that sends coordinates to the server on this. */
  ready: boolean;
}

// Frozen so getServerSnapshot() is referentially stable; React re-invokes
// it on every render and a fresh object each time would loop.
const SERVER_SNAPSHOT: CitySnapshot = Object.freeze({
  city: GENERIC_CITY,
  ready: false,
});

let snapshot: CitySnapshot | null = null;
const listeners = new Set<() => void>();

function emit(next: CitySnapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): CitySnapshot {
  // Lazily seeded with the device timezone — instant and offline, so the
  // placeholder stops saying "your neighborhood" without waiting on a
  // round trip. The edge answer overwrites it below.
  if (!snapshot) snapshot = { city: detectCity(), ready: false };
  return snapshot;
}

function getServerSnapshot(): CitySnapshot {
  return SERVER_SNAPSHOT;
}

/**
 * The visitor's city, resolved in two beats:
 *
 *  1. The device timezone, immediately.
 *  2. The CDN edge's view of where the request physically came from,
 *     which wins. Someone in Vancouver on a laptop still set to
 *     America/New_York flips from Fort Greene to Mount Pleasant here.
 */
export function useDetectedCity(): CitySnapshot {
  const current = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  useEffect(() => {
    if (snapshot?.ready) return;
    primeGeoCity().then((geo) => {
      emit({ city: geo ?? getSnapshot().city, ready: true });
    });
  }, []);

  return current;
}
