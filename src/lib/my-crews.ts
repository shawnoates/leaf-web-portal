"use client";

import { useCallback, useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import type { DashboardCrew } from "@/components/dashboard/types";

/**
 * The signed-in person's Friend Mode crews (getFriendModeHome), for the
 * dashboard sidebar. Past crews stay on the crew hub, not here.
 */
export function useMyCrews(enabled = true) {
  const [crews, setCrews] = useState<DashboardCrew[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    if (!Parse.User.current()) { setLoaded(true); return; }
    try {
      const r = (await Parse.Cloud.run("getFriendModeHome")) as { crews?: DashboardCrew[] };
      setCrews(r?.crews || []);
    } catch {
      // No crews section beats a broken dashboard.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => { void reload(); }, 0);
    return () => clearTimeout(t);
  }, [enabled, reload]);

  return { crews, loaded, reload };
}
