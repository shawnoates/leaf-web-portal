# "Claim Your Listing" Flow — Design Spec

## Context
In the DealPlan GTM funnel (`docs/dealplan-gtm-funnel.md`), Leaf pre-fills every
building's calendar with **free aggregated public deals** (happy hours, daily
specials) so the calendar is useful from day one. Two problems follow: (1)
scraped data goes stale — wrong hours/prices create bad resident experiences and
liability, and (2) Leaf needs a warm, low-cost path to identify and convert
businesses to paid exclusive deals.

**The Claim flow solves both.** It lets a business owner verify they own an
auto-generated listing and correct/confirm its details — for free. Strategically
it is the **cheapest, warmest lead-gen in the model**: a business that just
logged in to fix their listing is the single best moment to pitch an exclusive
deal. This spec defines the feature end to end.

Architecture note (same as the DealPlan spec): **`leaf-web-portal` is
frontend-only.** All data/logic runs through `Parse.Cloud.run(...)` against the
separate `leaflets-server` backend, which is not in this session. Backend items
below are **contracts to hand off**; frontend items land in this repo.

---

## Entry points (how a business reaches the claim flow)
1. **On the public listing:** a subtle "Own this business? Claim it" link on every
   aggregated deal card (org calendar / listing detail).
2. **Rep-initiated:** a sales rep sends a claim link or completes it with the owner
   (`createdVia:'rep'`), pre-filling known details.
3. **Outbound:** email/DM with a deep link to claim (ties to the upsell scripts).
4. **In-store QR (later):** a window cling / counter card linking to the claim page.

---

## Ownership verification (the trust gate)
A claim must prove the claimant controls the business. Tiered, easiest-first:
- **Phone OTP match (primary):** the listing carries the business's *public* phone
  (from the source). Send an OTP to that number; whoever answers it owns the line.
  Reuses the existing `requestOTP`/`verifyOTP` flow
  (`src/app/p/[eventGroupId]/StandalonePlanRsvp.tsx:188,202`).
- **Rep-assisted (override):** an authenticated rep vouches and claims on the
  owner's behalf; flagged for light audit.
- **Fallbacks (later):** Google Business Profile OAuth, email at the business
  domain, or manual review for disputes.
- **Disputes / multiple claimants:** first verified claim wins but is reversible;
  conflicts route to a `disputed` state for manual resolution. Franchises: claim
  is per-location (scoped to the `Location`), not per-brand.

---

## The flow (resident-facing = business owner)
1. Owner taps **"Claim this listing"** → `/business/claim/[listingId]`.
2. Page loads the listing via `getListingForClaim({ listingId })` and shows what
   Leaf currently displays (name, deal, hours, venue, impressions-to-date as the
   hook).
3. **Verify ownership** — OTP to the listing's public number (or rep override).
4. **Confirm & correct** the details in an editor that reuses existing patterns:
   - Venue via `VenueSearch.tsx` (Google Places → lat/long for later geofencing).
   - Deal title/description/terms, recurring schedule (e.g. "Happy hour M–F 4–6").
   - Image via the existing `processImageFile`/Unsplash pattern in
     `CreatePlanModal.tsx`.
5. **Submit** → `claimListing(...)`; listing flips to `claimed`, business gets a
   lightweight account/`Business` record.
6. **Post-claim upsell (the whole point):** immediately show "You're verified —
   here's your free monthly impressions report. Want to *prove* walk-ins? Add a
   resident-exclusive deal." CTA into the exclusive-deal creator (the DealPlan
   business self-serve surface). See `docs/dealplan-sales-scripts.md`.

---

## Backend spec (leaflets-server — hand off)

### Schema (extends the DealPlan spec's classes)
- **`DealListing`** (free aggregated deal) — distinct from paid `Deal`:
  `source` (`scrape`|`google`|`yelp`|`manual`), `sourceUrl`, `category`
  (`happy_hour`|`food`|`beauty`|`fitness`|`retail`|…), `title`, `description`,
  `recurringSchedule`, `venue`/`location` → Pointer `Location`, `phonePublic`,
  `building`/`org` scope, `impressionsCount`,
  `claimStatus` (`unclaimed`|`pending`|`claimed`|`disputed`), `claimedBy`,
  `claimedAt`, `lastVerifiedAt`, `active`.
- **`Business`** (from DealPlan spec) gains: `claimedListings[]`, `verifiedVia`
  (`phone_otp`|`rep`|`google`|`email`), `repOwner`.
- **`ListingClaim`** (audit): `listing`, `claimant` (phone/user), `method`,
  `status`, `verifiedAt`, `rep`.

### Cloud functions (contracts)
1. **`getListingForClaim({ listingId })` → listing payload + `impressionsCount`**
   (impressions included deliberately — it's the upsell hook on the page).
2. **`requestListingClaim({ listingId })`** → sends OTP to the listing's public
   phone; returns the masked target (`(•••) •••-1234`) so the owner knows where it
   went. (Or rep-override path.)
3. **`verifyListingClaim({ listingId, code })`** → validates OTP, marks the claim
   `pending`/verified.
4. **`claimListing({ listingId, edits, businessProfile })`** → persists
   corrections, creates/links `Business`, sets `claimStatus:'claimed'`,
   `lastVerifiedAt`. Idempotent; guards against double-claim/dispute.
5. **`getBusinessImpressionsReport({ businessId })`** → monthly impressions for the
   free report (and renewal hook).
6. **Rep variants** (`createdVia:'rep'`): `repClaimListing(...)` with audit flags.

---

## Frontend spec (THIS repo)
- **New route:** `src/app/business/claim/[listingId]/page.tsx` (+ a client
  component for the multi-step flow).
- **Reuse:**
  - OTP verify UI/flow from `StandalonePlanRsvp.tsx` (extract a shared
    `PhoneVerify` step if not already shared).
  - `VenueSearch.tsx` for venue/location.
  - Image handling + Unsplash from `CreatePlanModal.tsx`.
  - `verified-user` cookie (`src/lib/verified-user.ts`) for the lightweight
    business identity, or a real Parse account if logging in.
- **Claim CTA** added to aggregated listing cards on
  `src/app/org/[shareId]/page.tsx` and `src/components/CalendarLandingPage.tsx`.
- **Post-claim screen** that renders the impressions number and routes into the
  exclusive-deal creator (the DealPlan business self-serve surface).

---

## Edge cases / guardrails
- **Wrong public phone on the listing:** offer rep-assisted or email/Google
  fallback so a bad scrape doesn't block a legit owner.
- **Listing the owner doesn't want at all:** claim flow includes "this deal ended /
  remove it" — honor it (lead with control, never "pay to remove").
- **Stale data without a claim:** show a freshness/"unverified" hint and prompt
  claims for listings past `lastVerifiedAt` thresholds.
- **Brand vs. location:** claims and exclusivity are always scoped to a `Location`.

---

## Verification (acceptance plan)
1. **Backend:** `requestListingClaim` sends OTP only to the listing's stored public
   number; `verifyListingClaim` rejects wrong/expired codes; `claimListing` is
   idempotent and routes a second distinct claimant to `disputed`.
2. **E2E (web):** seed an unclaimed `DealListing` on a test building → open
   `/business/claim/<id>` (`npm run dev`) → see current details + impressions →
   verify via OTP → edit hours/venue/image → submit → listing shows `claimed` with
   corrected data on the calendar.
3. **Upsell handoff:** post-claim screen shows the impressions number and the CTA
   lands in the exclusive-deal creator pre-scoped to the claimed business.
4. **Rep path:** a rep can claim on a business's behalf with the audit flag set.
5. **Build/lint:** `npm run build` / `npm run lint` clean (Next 16 App Router
   conventions per `AGENTS.md`).
