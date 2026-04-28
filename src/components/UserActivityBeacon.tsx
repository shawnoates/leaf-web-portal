"use client";

import { useEffect } from "react";
import Parse from "@/lib/parse-client";

const STORAGE_KEY = "leaf:lastActivityPing";
const PING_INTERVAL_MS = 24 * 60 * 60 * 1000;

export default function UserActivityBeacon() {
  useEffect(() => {
    let cancelled = false;
    try {
      const user = Parse.User.current();
      if (!user) return;

      const last = Number(localStorage.getItem(STORAGE_KEY) || "0");
      if (Number.isFinite(last) && Date.now() - last < PING_INTERVAL_MS) return;

      Parse.Cloud.run("recordUserActivity")
        .then(() => {
          if (!cancelled) localStorage.setItem(STORAGE_KEY, String(Date.now()));
        })
        .catch(() => { /* non-fatal */ });
    } catch { /* Parse not initialized */ }

    return () => { cancelled = true; };
  }, []);

  return null;
}
