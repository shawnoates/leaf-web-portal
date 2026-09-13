# Interest nudge after following — design spec

Web only. One surface: the FollowModal success step on `/org/[shareId]`. A short list of open plan ideas with a heart each, under the existing "You're following!". Purpose: more real interest markers on ideas, so the needs-host queue has better signal for assigning hosts.

---

## 1. Why this moment

- The follower just verified a phone. `expressInterestOnPlanIdea` resolves identity from session or phone (`_resolveInterestIdentity`, `leaflets-server/cloud/ai-calendar-functions.js:412`), so a tap here writes a `PlanIdeaInterest` with `user`/`phone`, not just a cookie.
- The queue's `followerInterestCount` counts distinct people by user → phone → cookie with the calendar owner excluded (`host-roster-functions.js:1535-1559`). A phone-resolved tap can't be double-counted across browsers.
- `interest-notify.js` texts interested people when their idea is hosted, exempt from the 2-per-week SMS ceiling — so "we'll text you" is a true promise.
- The owner is most of the raw taps in prod (comment at `host-roster-functions.js:1530`). Non-owner markers are the scarce thing.

---

## 2. Placement

`src/app/org/[shareId]/page.tsx` → `FollowModal`, `formStep === "success"` (currently ~line 1403).

```
[✓ circle]
You're following!
You'll be notified about new plans from {calendarName}.

──────────────────────────────────────  ← border-t zinc-100, mt-7 pt-6
WAITING ON A HOST
Tap any you'd go to. If one gets a host, we'll text you.

──────────────────────────────────────
Sunday Pancake Breakfast           (♡)³
Sun, Sep 21 · Upper West Side
──────────────────────────────────────
Picnic on the Riverside lawn       (♡)²
Sat, Sep 27 · Riverside Park
──────────────────────────────────────
Board games at Hex & Co.           (♡)
Thu, Oct 2 · Upper West Side
──────────────────────────────────────

               DONE
```

The header block and Done button are unchanged from today.

---

## 3. Tokens (from the existing modal and idea card)

Modal container: `bg-white w-full max-w-md p-8`, `rounded-t-2xl` mobile, **`md:rounded-none`** desktop. Backdrop `bg-zinc-900/60 backdrop-blur-sm`. Close X `top-4 right-4 p-2`, zinc-400.

| Element | Spec |
|---|---|
| Success circle | 64px, `bg-emerald-50` `#ecfdf5`, check 32px `emerald-600` `#059669` |
| Title | `text-xl font-light` 20/28, zinc-900 |
| Sub | `text-sm` 14/20, zinc-500 `#71717a` |
| Section divider | `border-t` zinc-100 `#f4f4f5`, 28px above, 24px padding below (20 on mobile) |
| Kicker | `text-[11px] tracking-wider uppercase font-bold` zinc-400 `#a1a1aa` — same as calendar card kickers |
| Explainer | 14/20 zinc-500 |
| Row | min-height 68, padding 12px 0, `border-t` zinc-100, last row also `border-b`; gap 16 |
| Row title | 15/22, weight 400, zinc-900 |
| Row meta | 12/16 zinc-500 — `{Short weekday}, {Mon} {d} · {neighborhood or venue}` |
| Heart button | 44×44 round, `border` zinc-200, heart 18px zinc-400 stroke 2 |
| Heart, tapped | `bg-emerald-50 border-emerald-300`, heart filled `emerald-700` `#047857` |
| Count badge | `-top-1.5 -right-1.5`, min-w 20, h 20, `bg-emerald-700` white 11px bold; hidden at 0 |
| Done | `text-xs font-bold uppercase tracking-widest` zinc-500, centered, 24px above |

These are the calendar idea card's heart and badge exactly (`renderPlanIdeaCard`), at 44px instead of 48px to fit the row.

---

## 4. Behaviour

- **Tap** calls the existing `runPlanIdeaInterest(ideaId)` path — optimistic fill, count +1, server count reconciles. Revert on failure, silently.
- A tapped heart is disabled (no un-tap here; same as the calendar card).
- No toast, no "thanks", no animation beyond the fill. The count moving is the feedback.
- No submit. Taps are independent writes. **Done** and the X close the modal as today.
- Do not trigger the `notifyPromptFor` phone prompt — the follower already has a verified phone, so `interestIdentityParams()` carries it.
- The calendar page underneath reflects taps immediately (shared `planIdeaLocallyInterested` / `planIdeaInterestCounts` state) so the cards match when the modal closes.

---

## 5. Which ideas

- From `org.planIdeas`: not `isFeatured`, `sourceKind !== "featured"`, not already in `planIdeaLocallyInterested`, start not passed.
- Sort by interest count descending, then soonest — the needs-host queue's order, so a marker lands where it moves an idea nearest the auto-flag threshold (`interestThreshold`, default 5).
- Maximum 3. No "see more".
- Meta place: `location.neighborhood` when the venue is gated, otherwise venue name. Never the address.
- FollowModal will need the filtered list passed in as a prop (it currently receives only calendar id/name/brand).

---

## 6. When it does not render

Render today's success screen unchanged when any of these hold:

| Condition | Why |
|---|---|
| Zero qualifying ideas | Nothing to show |
| `followResult.pending` (private calendar) | A request, not a follow; wrong order to ask |
| `formStep === "intro"` (building share kit) | One ask per follow; the kit owns the moment |
| `canAskIntro === false` (follow gating a held heart tap) | The held tap replays on close; a list in between lands on the wrong moment |

---

## 7. Copy

- Kicker: **Waiting on a host** — matches the "Waiting on host" line on idea cards.
- Explainer: **Tap any you'd go to. If one gets a host, we'll text you.**
- No threshold numbers, no "help this happen", no urgency, no exclamation marks beyond the existing "You're following!".
- Titles and dates as they render on the calendar page.

### Rejected alternate

Replacing the meta line with progress — *"One more and we start finding a host"*. Stronger pull, but it exposes an admin-tunable threshold, promises queue motion that may not happen that week, and turns a light ask into a campaign. Shown on the canvas for the record.

---

## 8. Instrumentation

| Event | Properties |
|---|---|
| `follow_interest_list_shown` | calendarId, ideaIds (ordered), count |
| `plan_idea_interest` (existing call) | add `surface: "follow_success"` |
| `follow_interest_list_closed` | calendarId, tappedCount |

Watch: share of follows with ≥1 tap; change in `followerInterestCount` per idea on calendars with the list vs. before; how many listed ideas cross the threshold within 7 days.

---

## 9. Out of scope

Anything after the modal closes: no banner on the calendar page, no follow-up SMS asking for interest, no `/me` surface, no iOS.
