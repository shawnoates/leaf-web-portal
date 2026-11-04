"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

// Records that someone arrived on a plan page from a shared link (?src=…).
//
// This page usually navigates away within the same tick (PlanShareRedirect
// does a location.replace), and a fetch started just before a navigation is
// cancelled with it. sendBeacon is the API built for exactly that moment, and
// Parse accepts the app credentials in a text/plain body, so the event lands
// even as the page unloads. track() is the fallback for browsers without it.
//
// Nothing here identifies the visitor beyond what track() already does.

const APP_ID = process.env.NEXT_PUBLIC_PARSE_APP_ID || "";
const JS_KEY = process.env.NEXT_PUBLIC_PARSE_JS_KEY || "";
const SERVER_URL =
  process.env.NEXT_PUBLIC_PARSE_SERVER_URL || "https://api.getleaflets.co/parse";

export default function ArrivalTracker({
  src,
  planId,
}: {
  src: string | undefined;
  planId: string;
}) {
  useEffect(() => {
    if (!src) return;
    const props = { src: src.slice(0, 40), planId };
    // A host's Text your friends link: tell them it was opened. Beaconed for
    // the same reason as below; the calendar page repeats it harmlessly.
    const invite = /^i-([a-z0-9]{8})$/.exec(src);
    if (invite && APP_ID) {
      try {
        const body = JSON.stringify({ _ApplicationId: APP_ID, _JavaScriptKey: JS_KEY, token: invite[1] });
        if (!(typeof navigator.sendBeacon === "function" && navigator.sendBeacon(`${SERVER_URL}/functions/textInviteOpened`, body))) {
          void fetch(`${SERVER_URL}/functions/textInviteOpened`, { method: "POST", body, keepalive: true }).catch(() => {});
        }
      } catch { /* not worth failing the page over */ }
    }
    try {
      if (typeof navigator.sendBeacon === "function" && APP_ID) {
        const body = JSON.stringify({
          _ApplicationId: APP_ID,
          _JavaScriptKey: JS_KEY,
          event: "plan_share_arrival",
          props,
          path: window.location.pathname,
        });
        if (navigator.sendBeacon(`${SERVER_URL}/functions/recordWebEvent`, body)) return;
      }
    } catch {
      /* fall through to the ordinary tracker */
    }
    track("plan_share_arrival", props);
  }, [src, planId]);

  return null;
}
