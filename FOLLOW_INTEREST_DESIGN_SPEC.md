# Handoff: Post-follow interest modal ("Which of these would you go to?")

> Supersedes the earlier "interest nudge inside the FollowModal success step"
> direction (2026-09-13). Implemented 2026-09-14 as a standalone modal:
> `src/components/InterestPrompt.tsx`, wired in `src/app/org/[shareId]/page.tsx`
> (FollowModal `interest` prop + the one-tap follow popup).

## Overview
After a user follows **any** calendar that has suggestions enabled (starter ideas / suggested plans), Leaf shows a standalone modal with that calendar's suggested plans. Each plan is a photo card with the date, place and title over the image and a large heart in the middle. One tap marks interest — no confirmation, no second step. When the user is done:

- **Neighborhood calendar** → the Share Kit modal opens next.
- **Any other calendar** → dismiss and land on the calendar's public page.

This modal replaces nothing; it runs *before* the Share Kit and is the only post-follow surface for non-neighborhood calendars.

Two surfaces: **mobile** (9a) and **desktop** (9b).

## Gating
Show when both are true:
1. Follow just succeeded (this session, this calendar).
2. The calendar has suggestions enabled and ≥1 suggested plan available.

It shows on **every** follow (no once-per-calendar flag — dropped 2026-09-14); a re-follow is a fresh moment. It still never shows twice within one follow.

If suggestions are off or the list is empty: skip straight to the Share Kit (neighborhood) or the public page (everything else).

Copy never mentions hosts, hosting, or that a plan is unhosted. Do not surface how many other people are interested.

## Ordering
Sort suggested plans by **interest count, descending** (internal count — not displayed), then by soonest date, then by plan id for stability. Cap the list at 6; the list scrolls. Order is fixed when the modal opens — a tap must not re-sort the cards under the user's finger.

## Content
- Eyebrow (mobile): `IDEAS FOR THE GROUP` — 10.5px, 700, letter-spacing .1em, uppercase.
- Eyebrow (desktop): the calendar name, same treatment.
- Headline: **Which of these would you go to?**
- Subline (desktop only): *One tap marks interest. Nothing is a commitment.*
- Footnote (mobile, under the cards): *Nothing is a commitment. We'll text you if it happens.*
- Status line (bottom left): `Tap any you'd go to` → `{n} marked` (mobile) / `Tap as many as you like.` → `{n} marked. We'll text you if it happens.` (desktop).
- Primary button: **Done**. No Skip link on either surface (dropped 2026-09-14) — the ✕, Esc and the scrim close it.

The status line is text, not a control. Only Done, ✕ and the cards are tappable.

## Plan card
Shared: `position:relative; border-radius:16–18px; overflow:hidden`, photo fills the card (`object-fit: cover`), gradient scrim above the photo, text bottom-left, heart centered in the upper area. Card is one tap target; everything layered on it is `pointer-events:none`.

- Mobile (9a): full column width, height **176**, radius 18, gap 14.
- Desktop (9b): 3-up grid, `gap:16`, height **196**, radius 16.

Scrim: `linear-gradient(180deg, rgba(10,10,12,.05) 0%, rgba(10,10,12,.32) 45%, rgba(10,10,12,.81) 100%)`.

Text block, bottom-left (mobile `left/right:16px; bottom:14px`; desktop `left/right:14px; bottom:13px`):
- Meta line: `{weekday, date} · {place}` — 10px (9.5 desktop) / 700 / letter-spacing .09em / uppercase / `rgba(255,255,255,.8)`, margin-bottom 5.
- Title: Newsreader 400, 21px/1.18 (mobile) or 19px/1.2 (desktop), `#fff`, `text-wrap: pretty`, max 2 lines then ellipsis.

Heart: centered horizontally, vertically centered in the top **112px** (mobile) / **124px** (desktop) of the card. **64×64** mobile, **58×58** desktop. Outline stroke `#fff` 1.5px, `filter: drop-shadow(0 1px 3px rgba(0,0,0,.45))`.
- Untapped fill: `rgba(255,255,255,.12)`.
- Tapped fill: `#fff`, plus a `2px` ring on the card: `box-shadow: 0 0 0 2px #10b981`.

## Tap behavior + Lottie
Tapping an untapped card marks interest. Tapping a marked card **unmarks** it.

On tap:
1. Fire the heart fill-and-pop (~500ms, once, ending on the filled frame). `public/motion/heart-fill.json` is the iOS app's `Leaflet/Lotties/heart.json` recolored white, given a 12%-fill + outline base heart, and cut at frame 50 so it ends filled; played at 3.3× via `lottie-web` (light build, dynamically imported on first tap). If the player or asset fails to load, the CSS fill transition + keyframe is the fallback.
2. The green ring fades in over 150ms.
3. The status line updates.
4. Write the interest record immediately — one independent request per tap, optimistic UI, no batching on Done. A failed write reverts that card only, with a toast.

On unmark: short scale-back and the ring drops.
Reduced motion: skip the animation, cross-fade the fill.

## Layout
**Mobile (9a)** — 390×760 reference. Full-screen modal (not a sheet), bg `#18181b`.
- Header: padding `26px 24px 16px`. ✕ top-right (`rgba(255,255,255,.5)`). Eyebrow `rgba(255,255,255,.45)`. Headline Newsreader 27px/1.12, `#fff`, max-width 270.
- Cards: scrolling column, padding `4px 24px 0`, gap 14. Footnote 12.5px `rgba(255,255,255,.45)` after the last card.
- Footer: padding `16px 24px 26px` (+ safe area), status `rgba(255,255,255,.5)` 13.5px, Done — height 48, padding `0 30px`, radius 14, bg `#fff`, text `#18181b` 15px/600.

**Desktop (9b)** — 960×640 reference, centered over a `rgba(40,30,10,.32)` scrim. bg `#fbfaf7`, radius 12.
- ✕ top-right, `#a1a1aa`.
- Header: padding `40px 48px 0`, max-width 620. Eyebrow `#a1a1aa`. Headline Newsreader 33px/1.15 `#18181b`. Subline 14.5px `#71717a`.
- Grid: padding `26px 48px 8px`, `repeat(3, minmax(0,1fr))`, gap 16, scrolls.
- Footer: `16px 48px 24px`, `border-top: 1px solid rgba(0,0,0,.07)`, status `#71717a` 13.5px; right: Done — height 44, padding `0 26px`, radius 10, bg `#18181b`, text `#fff` 14px/600.

Between breakpoints, the grid drops to 2 columns before switching to the mobile layout.

## Exit
| Path | Neighborhood calendar | Other calendar |
|---|---|---|
| Done | Close, then open the Share Kit modal | Close (the public page is underneath) |
| ✕ / Esc / scrim | Same as Done | Same as Done |

Never chain the Share Kit for non-neighborhood calendars, and never show the interest modal twice in one follow.

## State (as built)
- Card ids are `idea:<CalendarGeneratedPlan.objectId>` and `ai:<aiSourceEvents index>` — both suggestion sources feed one list; around-the-city (featured) rows are excluded.
- Marked = the page's `planIdeaLocallyInterested` / `aiLocallyInterested` sets, so the calendar cards underneath agree the moment the modal closes.
- Writes: `expressInterestOnPlanIdea` / `removeInterestOnPlanIdea`, `expressInterestOnAIEvent` / `removeInterestOnAIEvent`.

## Instrumentation (as built)
`src/lib/track.ts` → `window.dataLayer` + cloud `recordWebEvent` (`WebEvent` class, `cloud/web-events.js`). Read in the admin portal at Analytics › Web events (`adminGetWebEventStats`).

| Event | Props |
|---|---|
| `follow_interest_list_shown` | source (`follow_modal` / `follow_popup`), count, itemIds (ordered), preMarked |
| `follow_interest_tap` | itemId, on (true = mark, false = unmark), title |
| `follow_interest_list_closed` | via (`done` / `skip`), marked |

Watch: share of shows with ≥1 mark, net marks per show, Done vs dismiss (✕/Esc/scrim, logged as `skip`), per-calendar breakdown, most-marked cards.

## Fallbacks
- Plan with no image: solid `#3f3f46` (mobile) / `#e4e4e7` (desktop) card with the same scrim and text. No stock substitute.
- 1–2 plans only: same card size, fewer rows. Do not stretch cards to fill.
- Slow images: card background color first, image fades in on load.

## Tokens (this surface)
- Mobile ground `#18181b`; desktop ground `#fbfaf7`; scrim `rgba(40,30,10,.32)`
- Card placeholder `#3f3f46` / `#e4e4e7`; photo scrim per above
- Confirm green `#10b981`; muted ink `#71717a` / `#a1a1aa`; ink `#18181b`
- Radii: 18 / 16 (cards), 14 / 10 (buttons)
- Headline + card title font: Newsreader 400; everything else the portal's default sans
