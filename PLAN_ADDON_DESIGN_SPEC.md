# Plan add-ons — design spec

Web only (Phase 0 decision D6). Two surfaces: the plan card on the public calendar page, and the RSVP confirmation step. Multiple add-ons per plan. This supersedes spec §10 ("one thing") where the two disagree.

Canvas: https://claude.ai/code/artifact/b6932f4e-9f71-4369-9d3f-1732194e9d27
Findings: `../PLAN_ADDON_PHASE0_FINDINGS.md` · Spec: `~/Downloads/plan-addon-spec.md`

---

## 1. Where it lives

| Surface | File / seam | What appears |
|---|---|---|
| Calendar page, plan card | `src/app/org/[shareId]/page.tsx` → `renderConfirmedPlanCard` | One hint line under "Hosted by …" |
| RSVP confirmation | `src/app/p/[eventGroupId]/StandalonePlanRsvp.tsx` `formStep === "success"` (and the equivalent success state in `RsvpModal`, `org/[shareId]/page.tsx`) | The option stack, between "You're in!" and "Open Plan Chat" |
| Plan page, after the stack | `PlanDetailModal.tsx` details column | One line under the venue, above the attendee count |

Nothing on `/me`, nothing in chat, nothing by push or SMS.

---

## 2. Tokens (lifted from the app, not rounded)

Font: Inter (`--font-geist-sans` alias). `-webkit-font-smoothing: antialiased`.

| Token | Value | Used for |
|---|---|---|
| zinc-900 | `#18181b` | ink, primary button, selected border |
| zinc-700 | `#3f3f46` | secondary button text |
| zinc-600 | `#52525b` | text-link buttons ("No thanks") |
| zinc-500 | `#71717a` | descriptions, meta |
| zinc-400 | `#a1a1aa` | eyebrows, fine print |
| zinc-300 | `#d4d4d8` | unchecked box border |
| zinc-200 | `#e4e4e7` | card hairline |
| zinc-100 | `#f4f4f5` | section dividers |
| emerald-600 | `#059669` | purchased check (same green as HOSTING) |
| white | `#fff` | sheets, cards |

Radii: card/stack item 12px · button 8px · checkbox 4px · modal 16px.
Backdrop: `rgba(24,24,27,0.6)` + `backdrop-blur-sm`.

Type scale used here:

| Role | Size / line / weight | Tracking | Case |
|---|---|---|---|
| Modal title (`h4`) | 24 / 32 / 300 | — | — |
| Stack heading | 15 / — / 500 | — | — |
| Item title, price | 15 / — / 500 | — | — |
| Item description | 13 / 19 / 400, zinc-500 | — | — |
| Hint line (calendar card) | 14 / 20 / 300, zinc-500 | — | — |
| Plan-page line | 12 / 18 / 400, zinc-500 | — | — |
| Button label | 12 / — / 700 | 0.05em | upper |
| Fine print | 11 / 16 / 400, zinc-400 | — | — |

---

## 3. Component: the option stack

Shown once per person per plan, on the confirmation step, only when the plan has ≥1 live add-on. Pattern: stacked option cards with a checkbox, running total on the button (the Fiverr "extras" pattern, in this vocabulary).

### Anatomy

```
Add to your morning                          ← 15/500, heading names the plan's moment
Prices include tax. One charge for whatever's ticked.   ← 12/18 zinc-500

┌─────────────────────────────────────┐  ← selected: 2px #18181b, padding 15
│ Coffee's waiting                 [✓]│  ← title 15/500 · box 20×20 r4 filled #18181b, white check 3px
│ Shawn picks up at 8:15, ready when  │  ← 13/19 zinc-500 (optional)
│ you arrive.                         │
│ $6                                  │  ← 15/500, own line, left
└─────────────────────────────────────┘
┌─────────────────────────────────────┐  ← unselected: 1px #e4e4e7, padding 16
│ A bite at the start              [ ]│  ← box 20×20 r4, 1.5px #d4d4d8
│ A pastry from Silver Moon…          │
│ $5                                  │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ A second coffee, for a friend    [ ]│  ← description is optional
│ $6                                  │
└─────────────────────────────────────┘

[         Add it · $6          ]         ← full width, 48px, #18181b, label 12/700 upper 0.05em
Card entry next. Nothing's charged yet.          No thanks
   ↑ 11 zinc-400                                   ↑ 12/700 upper zinc-600
```

Gap between cards 10px. Stack sits inside a block bounded by `border-top`/`border-bottom: 1px #f4f4f5`, padding 18px 0 20px.

### Behaviour

- Tapping anywhere on a card toggles it. Whole card is the hit target (≥44px).
- Button label is `Add it · $<sum>`. With nothing ticked: label `Add it`, disabled at 50% opacity. Never hide the button.
- Selected border change is the only motion; no scale, no shadow.
- **Add it** → inline Stripe Payment Element replaces the stack in place (findings §2.1a option B). Header keeps the ticked lines + total. Button becomes `Pay $<sum>`; secondary `Back`. Full card entry every time in v1 — no saved cards exist.
- **No thanks** → dismiss permanently for this plan. The stack never reappears; only the plan-page line remains.
- Order: host-defined; default by price ascending.
- Max 5 items rendered. Items past cutoff or at capacity are omitted, not disabled. If none remain, the stack does not render.

### Price display

Right-hand price on the same row as the title is **not** used here; price sits on its own line under the description. Same weight as the title. No `$` emphasis, no strikethrough, no "was", no "popular" badge, no quantity stepper. Tax is inside the number.

---

## 4. Component: the calendar-card hint

One line inside the plan card's header block, directly under "Hosted by …", before the description.

```
● HOSTED BY SHAWN                                   ← as today
Coffee's waiting, $6 · a bite at the start, $5 · a second coffee, $6 — add them after you RSVP
```

- 14/20/300, zinc-500. The trailing clause is zinc-400.
- Items joined with ` · `, lower-cased after the first, each with its price. Cap at 3 items; a fourth becomes `+1 more`.
- Singular: `Dinner's on the table, $18 — add it after you RSVP`.
- Not a badge, not a pill, not a button. It is text in the description's register.
- Rendered only while ≥1 add-on is live. Never on poll cards or cards the viewer hosts.
- Desktop and mobile identical; it wraps.

---

## 5. Component: the plan-page line

Under the venue line, above the attendee count, same size as both (12/18 zinc-500).

| Viewer state | Line |
|---|---|
| Dismissed or RSVP'd before add-ons existed | `Coffee, a bite, a second coffee · Add` (underlined link) |
| Purchased some | `✓ You're in for coffee and a bite · Change` (check emerald-600) |
| All items full or closed | `Coffee's waiting · closed` in zinc-400, no link |
| Host | `4 of 9 in for coffee · See list` |

`Add` reopens the stack in a sheet. `Change` opens the purchase list (cancel one item before its cutoff, or edit a note).

---

## 6. States

| State | Where | Rendering |
|---|---|---|
| Ask | confirmation step | the stack |
| Card entry | same slot | Payment Element, ticked lines + total above, `Pay $11` / `Back` |
| Added | same slot | `✓ You're in for coffee and a bite · Change` + one line: `$11, one charge. Shawn picks up at 8:15. Drop either one before 5:30 AM Thursday for that part back.` |
| Declined | plan page | the `Add` line only |
| Card declined | same slot | title `Didn't go through`, `Nothing was taken. Your RSVP stands either way.`, `Try again` / `No thanks`. Offered once, then falls back to the line |
| Item full / closed | stack | item omitted; plan page shows `· closed` greyed |
| No live add-ons | — | nothing renders anywhere |
| Fewer than 2 going incl. host | — | nothing renders |

---

## 7. Layout at the two breakpoints

**Mobile (390).** `StandalonePlanRsvp` is a bottom sheet: `rounded-t-2xl`, `p-8` (32). Calendar card stacks image (16:10, full width) over text; buttons stack vertically.

**Desktop (≥768).** RSVP modal centred, `max-w-md` (448), `rounded-2xl`, `p-12` (48). Calendar page `max-w-6xl` (1152) `px-6`; cards `flex-row gap-12 items-center`, image `w-3/5`, text `w-2/5`, every other card `flex-row-reverse`, `space-y-32` between. Buttons in a row.

The stack itself is a single column and does not change between widths.

---

## 8. Copy rules

- Titles are things, not offers: "Coffee's waiting", never "Add coffee".
- The description names a person and a time: "Shawn picks up at 8:15."
- State the cutoff in plain time in the Added state.
- No exclamation marks, no "treat yourself", no "don't miss out", no "most popular".
- Banned words: wine, beer, cocktail, drink(s), bottle, pour, tasting, spirits, cognac, game-changer, obsessed, group chat, curated experiences, seamlessly.
- Prices are whole dollars, `$6`, never `$6.00`, never "plus tax".

---

## 9. Data implications the design assumes

- Multiple `PlanAddon` rows per plan; each ticked item is its own purchase row under one PaymentIntent, so one item can be refunded and its host fee voided without touching the others.
- Cutoff and capacity are per item.
- Uniqueness: one paid/pending purchase per `(addon, user)` — per item, not per plan.
- `addon_card_shown` carries `surface: rsvp_confirm | calendar_page | plan_page` so the hint's exposure is visible in attach rate.
- Attach rate = `addon_added / addon_card_shown` on `rsvp_confirm`, with the target set for a full card entry (findings D5), not a tap.

---

## 10. Out of scope here

Host creation sheet, host fulfilment list, admin `/addons`, payouts — unchanged from the spec and findings; not part of these screens. iOS. Anything on `/me`.
