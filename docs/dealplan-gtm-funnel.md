# DealPlan GTM Funnel — Listed → Claim → Exclusive → Featured

## Context
Leaf monetizes the building calendar by selling local businesses access to the
neighbors around them. The hard part of any local marketplace is the **empty
shelf**: on day one there's no deal inventory, so residents don't engage, so
there's no audience to sell to businesses. This funnel solves that by
**aggregating existing public deals for free** to fill the calendar and build
demand, then converting businesses up a ladder toward paid, measured,
resident-exclusive deals.

**Core principle:** build demand-side liquidity first (free listings), monetize
supply second (exclusive + featured). The free layer is *bait*, the exclusive
deal is the *hook*, and **verified redemption is what turns the hook into a
renewal.**

The wedge between free and paid is **measurement**: a free listing creates
impressions but can't prove who walked in. Closing that proof gap is the entire
upsell.

---

## The four stages

### 1. LISTED — free, auto-populated
- **What:** publicly advertised recurring deals aggregated and categorized —
  happy hours, taco Tuesdays, daily specials, student/industry discounts,
  standing promos. Pulled from the business's own public sources (site, Google,
  Yelp, Instagram).
- **Populated by:** Leaf ingestion/scraping + categorization (happy hour / food /
  beauty / fitness / retail). No business action required.
- **Resident value:** the calendar is full and useful from day one — "what's
  cheap near me tonight."
- **Business value:** free incremental exposure to the nearest buildings.
- **What it is NOT:** static discovery only. No scheduling, no social, no
  featured placement, no redemption tracking. This line is sacred (see Guardrails).
- **Instrumentation:** impressions per listing, per building, taps to directions/
  call. This impression count is the raw material for every upsell.
- **➜ Conversion trigger to CLAIM:** any business with a listing getting
  meaningful impressions, OR a stale/incorrect listing (wrong hours/price) — both
  are reasons to reach out: "you're already getting seen / your info is wrong,
  come fix it free."

### 2. CLAIM — free, warms the lead
- **What:** the business owner claims their auto-generated listing, verifies they
  own it, and corrects/confirms the details. (Full feature spec:
  `docs/claim-listing-flow-spec.md`.)
- **Resident value:** accurate, trustworthy deal info (right hours, right price).
- **Business value:** control over how they appear + a free monthly impressions
  report ("400 neighbors saw your happy hour").
- **Why it matters strategically:** this is the **cheapest, warmest lead-gen in
  the whole model.** A business that just logged in to fix their listing is the
  single best moment to pitch the paid layer — they're already in the door,
  already see the impressions, already invested.
- **Instrumentation:** claim rate, time-to-claim, impressions report opens.
- **➜ Conversion trigger to EXCLUSIVE:** delivered at the *end* of the claim flow
  and in the monthly report — "you got 400 impressions but I can't prove a single
  walk-in. Add a resident-exclusive deal and I'll show you exactly who came."

### 3. EXCLUSIVE — paid, measured
- **What:** a resident-only deal that exists nowhere else ("20% off for [Building]
  residents," "free pastry with any drink, neighbors only"). This is where all the
  DealPlan machinery lives: residents **schedule** when they'll go, can open it up
  to **bring neighbors**, get a 15-min SMS reminder, and the discount **redeems
  only on verified location + time window.**
- **Resident value:** real exclusive savings + a social reason to go (group plans).
- **Business value:** the thing the free listing can't give — **proof.** A monthly
  report: "43 redemptions, 31 first-time customers, verified on location."
  Plus the social multiplier (one scheduler brings neighbors = higher ticket).
- **Pricing:** either model from the pricing analysis —
  - **Performance** ($0 + ~10%/sale or ~$8/new customer) to land risk-free, or
  - **Fixed monthly** once you've shown the numbers and it's cheaper for them than
    per-redemption fees.
- **Instrumentation:** scheduled plans, redemptions, new-vs-returning, group
  size, revenue attribution. This is the renewal engine.
- **➜ Conversion trigger to FEATURED:** a business seeing strong redemptions whose
  *competitor* is also listed/exclusive in the same building — sell category
  exclusivity before the competitor buys it.

### 4. FEATURED / CATEGORY-EXCLUSIVE — premium fixed
- **What:** top placement + **category exclusivity** on a building's calendar —
  you're the *only* coffee shop / salon / bar residents see.
- **Business value:** lock competitors out of your nearest buildings; permanent
  top-of-calendar presence.
- **Pricing:** Featured ~$99/mo, Exclusive ~$299/mo (own the category/building).
- **Instrumentation:** share-of-category impressions, competitor-locked buildings,
  renewal rate.

---

## The flywheel
Free listings fill the calendar → residents engage → impressions accumulate →
businesses claim to fix/control listings → claim surfaces the measurement gap →
they add an exclusive deal to get proof → verified redemptions prove ROI → they
renew and/or buy featured to lock out rivals → more deals make the calendar
better → more residents engage. Each turn makes both sides stickier.

## The measurement wedge (say this everywhere)
> "Your deal is already on the calendar — but a free listing can't prove who
> actually walked in. The only way to *know* what we're worth is an exclusive
> deal we can verify on location. That report is what you're really buying."

## Guardrails (protect the model)
1. **Free = static, paid = interactive.** Never let a free listing be
   schedulable, social, featured, or measured. If free does the job, no one pays.
2. **Don't cannibalize.** Exclusive/featured deals always outrank free listings in
   the same slot.
3. **Data accuracy is a liability.** Stale scraped deals create bad resident
   experiences and angry businesses — the Claim flow is the pressure-release valve.
4. **Lead with "claim & correct," never "pay to remove."** Aggregating public
   deals is fine (Yelp precedent); extractive framing poisons the relationship.

## North-star funnel metrics
- Listings per building (inventory density) and resident calendar engagement.
- **Claim rate** (free→identified lead) and time-to-claim.
- **Claim→Exclusive conversion** (the money step) and time-to-first-paid-deal.
- Redemptions per exclusive deal, new-customer %, **exclusive→renewal/featured**.
