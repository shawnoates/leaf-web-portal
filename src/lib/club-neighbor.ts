// Club Neighbor on a page that shows one plan (/p/<id>): is this ticket free
// for the person looking at it?
//
// The calendar page gets this with its own payload (getOrgCalendarPage's
// `clubNeighbor`). A single-plan page is rendered on the server with no
// session, so it asks from the browser, and asks again once the RSVP sheet has
// verified a phone and has a session to ask with. The server makes the same
// test at checkout, so "free" here is only ever the words on the button.

import { useEffect, useState } from "react";
import Parse from "@/lib/parse-client";

export function useClubNeighborFree(planId: string, enabled: boolean, sessionToken?: string | null): boolean {
  const [free, setFree] = useState(false);
  useEffect(() => {
    if (!enabled || !planId) return;
    let cancelled = false;
    Parse.Cloud.run("getClubNeighborForPlan", { planId }, sessionToken ? { sessionToken } : undefined)
      .then((r: { show?: boolean; member?: boolean }) => {
        if (!cancelled) setFree(r?.show === true && r?.member === true);
      })
      .catch(() => { /* not free, as far as this page knows */ });
    return () => { cancelled = true; };
  }, [planId, enabled, sessionToken]);
  return free;
}
