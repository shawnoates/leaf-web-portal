import { NextResponse } from "next/server";

// Apple App Site Association — declares which os.joinleaf.com URL paths the
// Leaf iOS app should intercept as Universal Links.
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
// Team ID + bundle id from leaflets-server iOS push config (index.js).
export async function GET() {
  return NextResponse.json({
    applinks: {
      apps: [],
      details: [
        {
          appID: "P2Q3GJZDXM.com.kontrast.leaflets",
          paths: ["/p/*", "/open/p/*"],
        },
      ],
    },
  });
}
