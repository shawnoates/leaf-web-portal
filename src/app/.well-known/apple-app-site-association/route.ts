import { NextResponse } from "next/server";

// Apple App Site Association — declares which os.joinleaf.com URL paths the
// Leaf iOS app should intercept as Universal Links.
//
// Paths is intentionally empty: adding a path here without a matching native
// handler in leaf-appcode/Leaflet/AppVM.swift handleURL causes iOS to open
// the app to its current state and do nothing, which is worse UX than the
// browser fallback users get when AASA doesn't claim a path.
//
// To enable Universal Links for /chat/*, /plan/*, etc.: first add native
// handlers in AppVM.handleURL for url.host == "os.joinleaf.com", then add
// the matching path patterns here.
//
// Team ID + bundle id from leaflets-server iOS push config (index.js).
export async function GET() {
  return NextResponse.json({
    applinks: {
      apps: [],
      details: [
        {
          appID: "P2Q3GJZDXM.com.kontrast.leaflets",
          paths: [],
        },
      ],
    },
  });
}
