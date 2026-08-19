import { NextRequest, NextResponse } from "next/server";

// Viewer geolocation from the CDN edge.
//
// The client-side companion is src/lib/detectCity.ts, which until now
// guessed the visitor's city from the *device* timezone. That's wrong for
// anyone travelling (a laptop still set to America/New_York in Vancouver
// gets Fort Greene copy), on a VPN, or with auto-timezone off. CloudFront
// already knows where the request physically came from — this route hands
// that to the browser.
//
// Why a route handler and not a proxy that sets a cookie: /personal is
// prerendered and served with `s-maxage=31536000` through CloudFront
// (`x-nextjs-prerender: 1`). A Set-Cookie attached to that HTML response
// risks being cached and handed to the next viewer, i.e. a Vancouver
// visitor's city leaking to a New York one. A separate no-store endpoint
// has no such interaction with the page cache.
//
// Amplify must actually forward the CloudFront-Viewer-* headers to the SSR
// compute for this to return anything. `?debug=1` lists which ones arrived
// so that's verifiable in one curl against prod. When nothing arrives we
// return available:false and the client silently keeps its timezone guess.

export const dynamic = "force-dynamic";

function num(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: NextRequest) {
  const h = request.headers;

  const geo = {
    city: h.get("cloudfront-viewer-city"),
    // -country-region is the code (BC), -country-region-name the label
    // (British Columbia). Prefer the label; nothing downstream parses it.
    region:
      h.get("cloudfront-viewer-country-region-name") ||
      h.get("cloudfront-viewer-country-region"),
    country: h.get("cloudfront-viewer-country"),
    // IP-derived IANA zone — the same shape as the device timezone the
    // client falls back to, so it drops straight into the existing
    // timezone → city table without a second lookup path.
    timeZone: h.get("cloudfront-viewer-time-zone"),
    lat: num(h.get("cloudfront-viewer-latitude")),
    lng: num(h.get("cloudfront-viewer-longitude")),
  };

  const available = Boolean(
    geo.timeZone || geo.city || (geo.lat !== null && geo.lng !== null)
  );

  const body: Record<string, unknown> = { ...geo, available };

  if (request.nextUrl.searchParams.get("debug") === "1") {
    // Header names only — enough to tell "Amplify isn't forwarding these"
    // apart from "this viewer's IP has no city".
    body.presentHeaders = [...h.keys()].filter((k) =>
      k.startsWith("cloudfront-")
    );
  }

  const res = NextResponse.json(body);
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}
