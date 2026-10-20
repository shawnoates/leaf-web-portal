"use client";

import { useEffect, useState } from "react";
import Parse from "@/lib/parse-client";

// The few points numbers the UI may show (today: the most a host can earn on a
// plan). They live on the server so changing a rule never needs a release;
// until it loads, or if it fails, the UI simply says "Leaf points".
let cached: { hostMax: number } | null = null;
let inflight: Promise<{ hostMax: number } | null> | null = null;

function load(): Promise<{ hostMax: number } | null> {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  const p: Promise<{ hostMax: number } | null> = Parse.Cloud.run("getPointsConfig")
    .then((c: { hostMax?: number }) => {
      if (c && typeof c.hostMax === "number" && c.hostMax > 0) cached = { hostMax: c.hostMax };
      return cached;
    })
    .catch(() => null)
    .finally(() => { inflight = null; });
  inflight = p;
  return p;
}

export function usePointsConfig(): { hostMax: number } | null {
  const [cfg, setCfg] = useState<{ hostMax: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    load().then((c) => { if (!cancelled && c) setCfg(c); });
    return () => { cancelled = true; };
  }, []);
  return cfg;
}
