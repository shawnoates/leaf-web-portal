# DealPlan Flow — Full-Stack Design Spec (no code this session)

## Context

Leaf wants **deal-driven social plans**: a local-business deal shows on an
apartment building's web calendar → a resident schedules when they'll go → that
becomes a joinable plan that seeds the building calendar → ~15 min before, the
resident gets an SMS with a redemption link → the discount redeems only when the
resident's **location + time window** are verified. This monetizes the calendar
(businesses pay on verified redemptions) while reusing the existing
scheduling/RSVP backbone.

The original handoff was written from `leaf-admin-portal` and assumed the
`EventDetail`/`EventGroup`/`EventNotification` model and cloud functions live in
`leaf-web-portal`. **They do not.** This deliverable is a **full-stack design
spec** (per your choice) — no code is written this session. It is grounded in the
real files of `leaf-web-portal` and clearly marks which work lands in this repo
(frontend) vs. the backend.

### Decisions locked with you
- **Scope:** design spec only, no implementation this session.
- **Deal source:** all three creation paths — Leaf admin seeding, business
  self-serve, **and a sales-rep path**.
- **Redemption geo:** **geofence primary, QR "Show & Scan" fallback**, configurable.
- **Window/radius:** **±60 min**, **~0.15 mi (~240 m)**, stored as config so they
  can be tuned per-deal or globally.

---

## Architecture reality (read this first)

`leaf-web-portal` is a **frontend-only Next.js 16 (App Router) + React 19 +
TypeScript** app. It holds **no business logic and no Parse schema**. Everything
data-related runs through `Parse.Cloud.run(<fn>, <params>)` against a **separate
Parse server (`leaflets-server`, at `api.getleaflets.co/parse` / `ali.joinleaf.com/parse`)
that is NOT in this session and cannot be edited from here.**

Consequences:
- The `EventDetail`/`EventGroup`/`EventNotification` classes, a `planType` field,
  the deal classes, the 15-min SMS cron, and geofence verification are **all
  backend work in `leaflets-server`** — specified below as contracts.
- SMS/Twilio, node-cron, haversine, and stored user location **do not exist in
  this repo**. (Web has *no* persisted user location today — that's iOS-only — so
  the redemption page must capture location live via `navigator.geolocation`.)
- This repo's job: render deals on the calendar, the schedule/privacy flow, the
  redemption page, and the three deal-creation surfaces — all calling new cloud
  functions.

Key real files (grounding):
- Parse client: `src/lib/parse-client.ts`
- Plan creation modal & the cloud-fn call patterns: `src/components/CreatePlanModal.tsx`
  (e.g. `createManualPlan` at `:427`, tz-suffix building at `:317-321`)
- Web RSVP + OTP + `rsvpToPlanViaWeb`: `src/app/p/[eventGroupId]/StandalonePlanRsvp.tsx`
  (`requestOTP :188`, `verifyOTP :202`, `rsvpToPlanViaWeb :224`)
- Public calendar/org page (plan list, RSVP, Google geocoder precedent):
  `src/app/org/[shareId]/page.tsx` (geocode + radius at `:1554-1606`)
- Host dashboard / approvals: `src/app/dashboard/[calendarId]/page.tsx`
  (`approveRsvpRequest :1175`, `declineRsvpRequest :1188`)
- Plans management + attendance: `src/app/dashboard/[calendarId]/plans/page.tsx`
  (`markAttendance :121`)
- Cookie-based verified-but-not-logged-in identity: `src/lib/verified-user.ts`
- Venue picker (Google Places): `src/components/VenueSearch.tsx`
- QR already in deps (`qrcode.react`): `src/components/PhoneVerificationModal.tsx`
- Deal-data source precedent (server route, radius search): `src/app/api/yelp/route.ts`

---

## Backend spec (leaflets-server — NOT editable here; hand to backend)

### Schema
- **`EventGroup.planType: string`** — add `'DealPlan'` alongside existing
  `'TripPlan'`/`'ReadyMade'`. Normal plans leave it null. This is the single
  discriminator the frontend keys off.
- **New class `Deal`** (the business offer / blueprint):
  - `business` → Pointer `Business` (or `Location`), `title`, `description`,
    `terms`, `discountType` (`percent`|`amount`|`bogo`|`custom`), `discountValue`,
    `location` → Pointer `Location` (lat/long + GeoPoint), `imageUrl`,
    `redeemRadiusMeters` (default 240), `redeemWindowMinutes` (default 60),
    `redemptionMode` (`geofence`|`qr`|`both`, default `both`),
    `active`, `building`/`org` scoping (which calendars it shows on),
    `createdBy`, `createdVia` (`admin`|`business`|`rep`), `pricingTier`
    (`performance`|`featured`|`exclusive`).
- **New class `Business`** (partner profile + billing): name, contact,
  `pricingTier`, Stripe customer ref, `repOwner` (the sales rep), `location`.
- **New class `DealRedemption`** (one per scheduled-then-redeemed deal):
  `deal`, `eventGroup`, `eventNotification`, `user`/verified-phone, `status`
  (`scheduled`|`reminded`|`redeemed`|`expired`|`failed`), `scheduledFor`,
  `reminderSentAt`, `redeemedAt`, `redeemLat`/`redeemLng`, `distanceMeters`,
  `method` (`geofence`|`qr`), `billable` flag.
- **`EventGroup.reminderSent15Min: boolean`** — cron state flag (default false).

### Cloud functions (frontend ↔ backend contract)
Mirror existing naming/return shapes so the frontend reuses its patterns.

1. **`listDealsForCalendar({ calendarId })` → `Deal[]`**
   Active deals scoped to that building/org, for the calendar render.

2. **`scheduleDealPlan({ dealId, calendarId, date, time, clientTimeZone, visibility })`**
   The core "resident schedules when they'll go." Server-side it follows the
   existing creation pattern (`createManualPlan` analog): create/reuse
   `EventDetail` from the `Deal`, create `EventGroup` with
   `planType:'DealPlan'`, set `expiryDate` from date+time, set `isOpenInvite`
   from `visibility`, create host `EventNotification` (status `Owned`), create
   the `DealRedemption` row (`status:'scheduled'`). `visibility ∈
   {'going','open'}` (see Privacy below). Returns `{ eventGroupId, eventNotificationId }`.
   - Enforce **mandatory advance scheduling** (reject if `scheduledFor` is < the
     lead time, e.g. < 30 min out — no instant redeem in v1).

3. **Reuse `rsvpToPlanViaWeb` / `approveRsvpRequest` / `declineRsvpRequest`**
   unchanged for **joining** an open deal plan (request → host accepts;
   Invited→Accepted). No new join function needed.

4. **`createDeal(...)` / `updateDeal(...)` / `setDealActive(...)`**
   Used by all three creation surfaces; `createdVia` distinguishes admin/business/rep.
   Admin & rep paths may set `createdByAdmin:true` and seed plans directly.

5. **`getDealRedemption({ token })` → redemption page payload**
   Resolves the SMS link token to `{ deal, business, location{lat,lng,name,address},
   scheduledFor, window, radius, redemptionMode, status }`. Token is unguessable
   (per-`DealRedemption`), so the page needs no login.

6. **`redeemDeal({ token, lat, lng, method })` → `{ ok, status, reason? }`**
   The verification core. Server computes haversine(distance) between
   `(lat,lng)` and the deal `Location`, checks `now` ∈ `[scheduledFor ± window]`,
   and on pass sets `DealRedemption.status:'redeemed'` + billing flag. `method`
   is `geofence` (coords required) or `qr` (cashier-initiated; window-only check).
   Rejects with a reason the UI can show (`too_far`, `outside_window`,
   `already_redeemed`, `expired`).

7. **Cron job (node-cron, poll + state flag)** — pattern of the existing
   `SendOpenInviteReminders`: every ~5 min, query `EventGroup` where
   `planType:'DealPlan'` AND `expiryDate` in the next 14–15 min AND
   `reminderSent15Min:false`; for each, SMS the resident the redemption link
   (`/redeem/<token>`), set `reminderSent15Min:true`, mark `DealRedemption`
   `status:'reminded'`. Reuse the server's `sendSMS`/Twilio util.

8. **Billing** (can be phase 2): on `redeemDeal` success, record a billable
   event per `Business.pricingTier` (Performance: 10%/sale or $8/new customer;
   Featured $99/mo; Exclusive $299/mo). Surface counts to dashboards.

---

## Frontend spec (THIS repo — leaf-web-portal)

### 1. Deals on the calendar
On the public/org calendar (`src/app/org/[shareId]/page.tsx`, and the shared
`src/components/CalendarLandingPage.tsx`), add a **Deals** strip/section that
calls `listDealsForCalendar`. Each deal card shows business, offer, discount, and
an **anonymized momentum** line ("3 neighbors going Thu 7pm") computed from
`DealPlan` EventGroups. CTA: **"Schedule when you'll go."** Reuse existing card
styling and the `Plan`/image patterns already in that file.

### 2. Schedule + privacy flow
New modal (model it on `CreatePlanModal.tsx`, but deal-specific and far simpler —
no plan-type toggle, no series). Fields: date + time (reuse the **tz-suffix
construction** at `CreatePlanModal.tsx:317-321` and `min={today}`), plus a
**privacy choice**:
- **"I'm going"** (default) → `visibility:'going'`: identity hidden, contributes
  to anonymized momentum, **not joinable**.
- **"I'm going + open to company"** → `visibility:'open'`: resident becomes host,
  plan is joinable and seeds the calendar (`isOpenInvite:true`).
Submit → `scheduleDealPlan`. Identity for non-logged-in residents uses the
existing OTP + `verified-user` cookie flow (`StandalonePlanRsvp.tsx`,
`src/lib/verified-user.ts`).

### 3. Joining an open deal plan
Reuse the existing RSVP flow verbatim — `rsvpToPlanViaWeb` →
`approveRsvpRequest`/`declineRsvpRequest` (Invited→Accepted). Open deal plans
render through the existing `/p/[eventGroupId]` and org-page RSVP UI.

### 4. Redemption page — NEW route `src/app/redeem/[token]/page.tsx`
Target of the SMS link. On load, call `getDealRedemption({ token })`. Then:
- **Geofence (primary):** call `navigator.geolocation.getCurrentPosition()`,
  POST coords via `redeemDeal({ token, lat, lng, method:'geofence' })`. Show a
  big **"Redeemed ✓"** screen for the cashier to glance at, or a clear failure
  reason (`too_far` / `outside_window`).
- **QR fallback (configurable / on geo-denied or `redemptionMode:'qr'`):** render
  a `qrcode.react` code (already a dependency) encoding the token; cashier
  scans/taps to trigger `redeemDeal({ token, method:'qr' })` (window-only check).
- Respect per-deal `redeemRadiusMeters`/`redeemWindowMinutes`/`redemptionMode`
  from the payload; default 240 m / ±60 min / both.
- No haversine needed client-side (server computes it); the existing Google
  geocoder precedent at `org/[shareId]/page.tsx:1554-1606` confirms the
  client-side geolocation pattern is acceptable here.

### 5. Three deal-creation surfaces
- **Admin seeding:** internal — primarily backend `createDeal`/seed scripts; a
  thin admin screen in this repo is optional for v1.
- **Business self-serve:** new route under `src/app/` (e.g. `/business/deals`)
  — a deal editor (business, partner venue via `VenueSearch.tsx`, discount,
  terms, window/radius, image via the existing `processImageFile`/Unsplash
  pattern) calling `createDeal`/`updateDeal`, plus a Stripe-backed pricing-tier
  pick (Stripe is already a dep).
- **Sales-rep path:** same editor gated to rep accounts (`createdVia:'rep'`),
  letting a rep create a deal *and* `Business` profile on a partner's behalf and
  optionally seed starter plans (`createdByAdmin:true`).

### 6. `planType` exclusion (keep deals out of normal plan lists)
There is **no `planType` field in this repo today** (web distinguishes only
`isPoll`). Once the backend adds `planType`, ensure normal plan queries/renders
**exclude `'DealPlan'`** so deals don't pollute standard lists. The filtering is
backend-side in the cloud functions that power these screens, but verify each
surface renders correctly: `src/app/org/[shareId]/page.tsx`,
`src/app/dashboard/[calendarId]/page.tsx`,
`src/app/dashboard/[calendarId]/plans/page.tsx`,
`src/components/CalendarLandingPage.tsx`. Deal plans get their own Deals section
instead.

---

## Privacy model (summary)
Per-plan, default-private. `'going'` = anonymized momentum only, not joinable.
`'open'` = host + joinable + seeds calendar. Joining `'open'` reuses
Invited/Accepted. No identities exposed in momentum counts.

## Compliance / open items (flag to product, not blockers for the spec)
- **TCPA**: explicit SMS opt-in + location-consent copy on the schedule step;
  capture consent timestamp on `DealRedemption`.
- Twilio cost at scale; reminder de-dupe via `reminderSent15Min`.
- One-tap reschedule / "not going" (reuse cancel/remove patterns) — phase 2.
- Cold-start seeding: solo-friendly deals + admin/rep-seeded plans.

## Phasing
- **P1 (backend):** schema (`planType`, `Deal`, `Business`, `DealRedemption`),
  `scheduleDealPlan`, `getDealRedemption`, `redeemDeal`, reminder cron.
- **P1 (frontend):** deals on calendar, schedule+privacy modal, redemption page.
- **P2:** business/rep creation UIs, Stripe billing on verified redemptions,
  reschedule/not-going, richer momentum.

---

## Verification (when implementation happens later)
Because this session produces only the spec, verification is the acceptance plan
for the implementation phase:
1. **Backend unit:** `redeemDeal` accepts a point inside radius & window;
   rejects `too_far`, `outside_window`, `already_redeemed`, `expired`. Cron
   selects only `planType:'DealPlan'` rows in the 14–15 min window once each
   (state-flag idempotency).
2. **End-to-end (web):** seed a `Deal` on a test building → load the org calendar
   (`npm run dev`, open `/org/<shareId>`), confirm the deal renders with momentum
   → schedule "I'm going" and "open to company", confirm an `'open'` one becomes
   a joinable `DealPlan` EventGroup and a `'going'` one does not → confirm normal
   plan lists exclude it.
3. **Reminder + redemption:** force a `DealPlan` to start in ~14 min, confirm one
   SMS with `/redeem/<token>`; open the link, allow location → "Redeemed ✓";
   deny location → QR fallback; spoof a far coordinate → `too_far`; redeem
   outside ±60 min → `outside_window`.
4. **Creation surfaces:** business and rep editors create a `Deal` (+`Business`)
   via `createDeal` and it appears on the targeted calendar.
5. **Build/lint:** `npm run build` / `npm run lint` clean (note `AGENTS.md`: this
   is a customized Next.js 16 — follow its App Router conventions; the
   `node_modules/next/dist/docs/` guides referenced there were not present in
   this checkout, so use standard Next 16 App Router patterns).
