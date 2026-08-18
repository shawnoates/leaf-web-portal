// Canonical public origin for the web portal. Single source of truth for
// og:url, metadataBase, share links, and anything else user-visible.
//
// The product moved from os.joinleaf.com to joinleaf.com. os.joinleaf.com
// still serves every route (years of SMS links, QR codes, and print pieces
// point there) — it just isn't canonical any more, so metadata generated
// from these constants always names joinleaf.com regardless of which host
// served the request.
//
// www, not the apex — the apex 302s to www, and unfurlers that re-resolve
// og:url would take a second hop for nothing.
export const SITE_URL = "https://www.joinleaf.com";

// Bare host for display: what we print in the UI when showing someone their
// public calendar address ("joinleaf.com/org/abc"). Deliberately without the
// scheme or the www — it's read, not clicked.
export const SITE_HOST = "joinleaf.com";

// Origin for URLs the iOS app is supposed to intercept as Universal Links —
// today only /p/* and /open/p/* (see the AASA route and AppVM.handleURL).
//
// Deliberately still os.joinleaf.com. Shipped iOS builds declare
// `applinks:os.joinleaf.com` and hard-check `url.host == "os.joinleaf.com"`,
// so a plan link on any other host opens Safari instead of the app for
// everyone who hasn't updated. Fold this into SITE_URL once the release
// adding `applinks:joinleaf.com` (plus the matching host check) has broad
// adoption — at which point this constant should disappear, not change.
export const APP_LINK_URL = "https://os.joinleaf.com";
