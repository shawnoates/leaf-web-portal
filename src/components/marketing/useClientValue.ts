"use client";

import { useSyncExternalStore } from "react";

// Read a client-only value (Parse's current user, today's date, a media
// query) without a setState-in-effect cascade.
//
// The server snapshot is a fixed fallback, so SSR and the first client
// paint agree; the real value is computed once on the client and cached,
// so getSnapshot stays referentially stable across renders — React
// re-invokes it every render and a fresh object each time would loop.
// Same shape as `useDetectedCity`, which this repo already leans on.

const NO_SUBSCRIBE = () => () => {};

export function makeClientValue<T>(compute: () => T, serverValue: T) {
  let cached: { value: T } | null = null;
  const getSnapshot = (): T => {
    if (!cached) cached = { value: compute() };
    return cached.value;
  };
  const getServerSnapshot = (): T => serverValue;
  return {
    use: () =>
      useSyncExternalStore(NO_SUBSCRIBE, getSnapshot, getServerSnapshot),
    /** Drop the cache so the next read recomputes — used after an event
     *  that could change the answer (a login, say). */
    invalidate: () => {
      cached = null;
    },
  };
}
