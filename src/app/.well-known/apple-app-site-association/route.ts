import { NextResponse } from "next/server";

// Apple App Site Association — declares which URL paths the Leaf iOS app
// should intercept as Universal Links.
//
// Served from every host this app answers on. Today shipped builds only
// declare `applinks:os.joinleaf.com`, so os.joinleaf.com is the host that
// actually matters; joinleaf.com serves the same file so the entitlement can
// add it without a second deploy. Apple fetches this over HTTPS with no
// redirect following, which is why next.config.ts excludes `.well-known`
// from the apex → www redirect.
//
// Universal Link paths. WARNING: each path here needs a matching native
// handler in leaf-appcode/Leaflet/AppVM.swift handleURL — otherwise iOS
// intercepts the URL, opens the app to its current state, and does nothing.
//
// /p/*       — new-plan SMS deep link; handler calls
//              PushNotificationManager.handleNewOrgPlanNotification.
// /open/p/*  — Universal Link bouncer for in-page "Save / Open / I'm
//              Attending" taps. Same payload as /p/* but at a distinct
//              path so iOS will trigger interception even when the user
//              is already on /p/<id> in Safari (iOS suppresses UL
//              interception when the target equals the current page).
//
// /poll/*/*    — planning-chat poll vote link (two segments: /poll/<one>
//                is the calendar date poll and stays a web page). Handler
//                joins the chat via joinPlanningSessionFromPollLink then
//                opens it. Behind POLL_LINKS_OPEN_IN_APP because iOS caches
//                this file per install: a build that claims
//                www.joinleaf.com but predates the handler would swallow
//                the tap and show nothing. Set the env to "1" in Amplify
//                once the release carrying AppVM.handlePollLink is out.
// /open/poll/* — bouncer behind the vote page's "Open in app" button,
//                same reason /open/p/* exists.
//
// Team ID + bundle id from leaflets-server iOS push config (index.js).
const POLL_LINK_PATHS = ["/poll/*/*", "/open/poll/*"];

export async function GET() {
  const pollLinksOpenInApp = process.env.POLL_LINKS_OPEN_IN_APP === "1";
  return NextResponse.json({
    applinks: {
      apps: [],
      details: [
        {
          appID: "P2Q3GJZDXM.com.kontrast.leaflets",
          paths: [
            "/p/*",
            "/open/p/*",
            ...(pollLinksOpenInApp ? POLL_LINK_PATHS : []),
          ],
        },
      ],
    },
  });
}
