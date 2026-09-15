# Design spec: Series hosts ("Monthly Wine Club, 2nd Tuesday")

> Status: draft for review, 2026-09-14. Nothing built yet.
> Spans both repos: `leaflets-server/cloud` (Parse Cloud Code) and this portal.
> Prompted by an 11 Hoyt Hangouts follower who wants to run a monthly wine club
> on the calendar without the owner running it for him.

## Overview
A calendar owner (or co-host) creates a recurring plan and names a **follower** as its host. The host accepts by text. Before each occurrence Leaf texts the host to **keep the proposed date or pick another**; only then does the occurrence go live and followers hear about it. If the host doesn't answer, **that month is skipped**. The host can move, skip, edit or end the series at any time from a no-login page, with a one-time phone code for anything beyond confirming a date.

The host never becomes a co-host and gets no dashboard access. The owner keeps the calendar and can see, reassign or end any series.

## Decisions (from review, 2026-09-14)
| Question | Decision |
|---|---|
| Host doesn't confirm by the final reminder | **Skip that month** |
| What the host can change | **Everything**, including ending the series. Owner can still override. |
| Host page security | **Signed link + one-time phone code**. Confirming the proposed date works with the link alone; everything else asks for a code sent to the host's phone on file. |

## What exists today (and the gaps)
- `PlanSeries` (`cloud/recurringPlans.js`) supports `weekly | biweekly | monthly`. Monthly repeats the same day of the month (`computeNextDate`, :38). There is no nth-weekday rule.
- `createPlanSeries` (:143) always makes the **caller** the host (:63). There is no host parameter.
- The next occurrence is created when the current one starts (`materializeDuePlanSeries`, :654), using the series' planned dates. If someone moves an occurrence (`updatePlanDetails` → `applyPlanStartDate`), the series doesn't notice.
- `changePlanHost` (`functions.js:27210`) changes a single occurrence. The next occurrence reverts to `series.host`.
- Moving a date posts a chat system message only. RSVPs get no text or push.
- Follower fan-out fires from the EventGroup afterSave when a plan is **created with, or newly attached to, a `publicGroup`** (`functions.js:4335`, `notifyFollowersOfNewPlan` :4469). It does not look at `isDraft`.
- **Reliability bug:** `materializeDuePlanSeries` / `materializeDueIdeaSeries` run only from the in-memory `node-schedule` (`jobScheduler.js:671,694`). `initializeScheduledJobs()` runs on every instance (`index.js:1231`) and neither job is in `.ebextensions/cron-jobs.config`. Materialization isn't idempotent, so more than one instance can create duplicate occurrences, and a restart at :05 skips an hour. This spec fixes that.
- Reusable pieces:
  - HMAC links: `hmacTokenSync` / `verifyHmacToken` (`unsubscribe-helpers.js`), used the same way as `rescheduleToken` (`plan-reschedule.js:55`)
  - Wall-clock picker flow: `wallClockOf` / `parseWallClockInTimezone` (`timezone-utils.js:171`) and `app/plans/reschedule/[planId]/RescheduleClient.tsx`
  - Quiet window: `isWithinQuietWindow` / `nextQuietWindowOpen` (`starter-card-hosted.js`) with `calendarTimezone` (`leaf-host-helpers.js:31`)
  - OTP: `requestOTP` / `verifyOTP`
  - SMS: `sendSmsTracked`

## Model

### Proposals live on the series, not as hidden plans
An unconfirmed month is **not** an EventGroup. The series stores the proposed date. When the host confirms, the EventGroup is created at the chosen time through `materializePlanInstance`, so follower fan-out, the "happening again" copy and calendar sync all work unchanged. Unconfirmed dates never appear in feeds, iOS, the weekly digest or leaderboards. Nothing needs an `isDraft` filter.

### `PlanSeries` additions
| Field | Type | Notes |
|---|---|---|
| `freq` | string | Adds `monthlyNthWeekday` and `hostPicks` to the existing values |
| `nth` | number | `1–4`, or `-1` for "last". Only for `monthlyNthWeekday`. |
| `weekday` | number | `0–6` (Sun–Sat). Only for `monthlyNthWeekday`. |
| `wallTime` | string | `"19:00"`, local time. Rule dates are built from `wallTime` + `timeZone`, so they stay correct across DST. |
| `timeZone` | string | IANA zone. Taken from `calendarTimezone(calendar)`, then the venue zone, then `America/New_York`. |
| `hostManaged` | boolean | `true` when the host confirms each date. Existing series stay `false` and keep auto-publishing. |
| `hostStatus` | string | `invited` → `accepted` / `declined` |
| `hostInvitedAt`, `hostAcceptedAt` | date | |
| `nextRuleAt` | date | The rule's next anchor date (e.g. 2nd Tue Oct, 7pm). Moves forward one month per cycle **no matter where the host actually puts the date**. |
| `proposalStatus` | string | `none` / `awaitingHost` |
| `proposalOpenedAt`, `reminder1SentAt`, `reminder2SentAt` | date | Cleared when each cycle starts |
| `consecutiveSkips` | number | Resets to 0 when a date is confirmed |
| `skippedCycles` | array | `[{ ruleAt, skippedAt }]`, shown to the owner |
| `pausedReason` | string | `noHost` / `repeatedSkips` / `hostDeclined` |

Scope for v1: `hostManaged` series support **`monthly`, `monthlyNthWeekday` and `hostPicks`**. Weekly and biweekly series stay auto-publish only; a three-week lead time doesn't fit them.

Existing ACL: the series and each occurrence are writable by `webOwner` only. All host writes go through master-key Cloud functions that check authorization, as `updatePlanDetails` already does.

## Lifecycle

### 1. Create (owner or co-host, dashboard)
`createPlanSeries` gets new params `hostUserId`, `freq`, `nth`, `weekday`.
- Host eligibility is the check from `changePlanHost`: a follower/member of the calendar or its parent org, or the caller.
- **Host is the caller:** works as today (auto-publish), plus the new rules.
- **Host is someone else:**
  - `hostManaged = true`, `hostStatus = invited`, series active.
  - If the owner picked a first date, it's stored as the first proposal. Nothing is created yet.
  - The host gets the invite text (T1).

### 2. Accept or decline (host)
`/series/[seriesId]?t=` shows the invite and asks for a one-time code, because accepting ties the host's identity to the series.
- **Accept:**
  - `hostStatus = accepted`.
  - If a first date was set and is still at least 48 hours away, it goes live immediately; accepting counts as confirming it.
  - Otherwise the first proposal cycle opens now.
- **Decline:** the series pauses (`pausedReason = hostDeclined`) and the owner sees it on the dashboard with **Change host**.
- **No answer after 7 days:** one resend (T1b). After 14 days, pause with `noHost`.

### 3. Proposal cycle (hourly sweep)
New cron `sweepSeriesHostCycles` runs hourly through `/jobs/`, leader-gated (see Jobs). For each active series with `hostManaged`, `hostStatus = accepted`, no upcoming published occurrence, and `proposalStatus = none`:

**Rule-based** (`monthly`, `monthlyNthWeekday`), where *R* = `nextRuleAt`:

| When | What happens |
|---|---|
| R − 21d | Open the proposal (`awaitingHost`) and send T2: "keep it or pick another date" |
| R − 10d | Send T3, the final reminder, which states the skip deadline |
| R − 7d, no answer | **Skip:** push a `skippedCycles` entry, `consecutiveSkips += 1`, move `nextRuleAt` forward one month, close the proposal. Send T4 to the host. Followers get nothing. |

**`hostPicks`**, where *E* = end of the last occurrence (or accept time):

| When | What happens |
|---|---|
| E + 1d | Open the proposal and send T2b: "when's the next one?" |
| + 11d | Send T3b |
| + 21d, no date | Skip the cycle; the next one opens 30 days later |

**Repeated skips:** after **2 consecutive skips** the series pauses (`repeatedSkips`) and the owner is told (dashboard badge + inbox item). This stops a silent series from texting the host forever. *(Open question 1.)*

All texts follow the calendar's 9am–9pm local window. The sweep runs hourly, so an out-of-window text goes out on the first run after 9am.

### 4. Confirm or pick a date (host)
`confirmSeriesOccurrence({ seriesId, token, wallClock? })`
- If `wallClock` is left out, the proposed rule date is confirmed. **The link alone is enough for this.**
- A different `wallClock` needs a host session (OTP).
- Allowed range: at least 24 hours from now and at most 60 days out, and not the same day as another live occurrence of this series.
- Creates the occurrence with `materializePlanInstance(series, instant)`.
  - Follower fan-out comes from the existing afterSave.
  - The "happening again" check compares against `firstInstanceAt`. Set `firstInstanceAt` when the first occurrence is actually created, not at series creation.
- Moves `nextRuleAt` forward one month from **R**, not from the chosen date, so moving October leaves November on its 2nd Tuesday. Resets `consecutiveSkips`. Closes the proposal.

### 5. Changes after going live (host session, or owner/co-host)
- **Move:** `moveSeriesOccurrence({ eventGroupId, wallClock })`
  - Uses `applyPlanStartDate` and follower plan-row sync, as `updatePlanDetails` does.
  - **New:** texts accepted and waitlisted RSVPs (T5), inside the quiet window. Outside it, stamp `rsvpMoveNotifyDueAt` and deliver on the next sweep.
  - Posts the existing chat system message.
- **Skip:** cancels the occurrence through the existing cancel path, so attendees are told as today. It counts as a host-chosen skip and does **not** add to `consecutiveSkips`.
- **Edit series:** `updatePlanSeries`
  - Editable: title, description, image, `wallTime`, venue, capacity, requireApproval, hideVenueUntilRsvp, `freq`/`nth`/`weekday`.
  - Changes apply to future occurrences. An "Also update the next one" toggle applies time and venue to the upcoming live occurrence, which triggers T5 when the time changes.
  - Changing the rule recomputes `nextRuleAt` and closes any open proposal.
- **End series:** `cancelPlanSeries` now also allows `series.host`. Already-live occurrences stay unless the host also skips them. The owner is told.

### 6. Owner controls (dashboard)
- **Change host:** `changeSeriesHost({ seriesId, hostUserId })`
  - Sets `series.host` and `hostStatus = invited`, and re-sends T1.
  - Runs the `changePlanHost` logic on every future live occurrence.
  - The old host's links stop working because the token includes the host id.
- **Resume** a paused series. **End series.** **Resend invite.**

## Auth
- **Token:** `hmacTokenSync(`${seriesId}:${hostUserId}:seriesHost`)`. It's tied to the current host, so reassigning invalidates old links.
- **Link only:** read the host page (title, rule, next proposal or occurrence, RSVP count, upcoming dates) and one-tap confirm the proposed date.
- **Host session:**
  - `requestSeriesHostCode({ seriesId, token })` sends an OTP to **the host's phone on file**. The page shows only the last 2 digits, and the phone can't be entered.
  - `verifySeriesHostCode({ seriesId, token, code })` returns a session token.
  - Every mutation other than one-tap confirm checks that `request.user.id === series.host.id`, or that the caller is the owner, a co-host or an admin.
- Rate-limit the public token endpoints the same way `host-offer-functions.js:177` does.
- Attendee **names** only appear on the host page, never phone numbers. *(Open question 2.)*

## Texts
Trigger names are for `SmsLog` via `sendSmsTracked`. These are transactional texts the host signed up for, so they **don't count** against the shared 2/week extra-SMS limit (`extraSmsSlotUsed`); that limit is for promos and nudges. They do respect quiet hours.

| # | Trigger | Copy |
|---|---|---|
| T1 | `seriesHostInvite` | {Owner} from {Calendar} asked you to host {Title} ({rule, e.g. "2nd Tuesday monthly"}). You set the dates; we'll remind you before each one. Accept: {link} |
| T1b | `seriesHostInviteResend` | Still up for hosting {Title} on {Calendar}? {link} |
| T2 | `seriesProposal` | {Title}: next one is {Tue Oct 13, 7pm}. Keep it or pick another date: {link} |
| T2b | `seriesProposalPick` | When's the next {Title}? Pick a date and we'll tell everyone: {link} |
| T3 | `seriesProposalFinal` | Last call for {Month} {Title}: keep {Tue Oct 13} or pick a date by {Tue Oct 6}, or we'll skip this month. {link} |
| T3b | `seriesProposalPickFinal` | Pick a date for the next {Title} by {Tue Oct 6}, or we'll check back next month. {link} |
| T4 | `seriesCycleSkipped` | No {Title} in {October}. We'll check in about {November}. {link} |
| T5 | `seriesOccurrenceMoved` | {Title} moved to {Thu Oct 15, 7pm}. Still coming? {plan link} |

If the host has `smsNotificationsDisabled`: send a push if they use the app, otherwise email if one is on file. If none of those work, pause with `noHost` and tell the owner. A host who can't be reached shouldn't turn into silent monthly skips.

## Portal UI

### Create plan (`src/components/CreatePlanModal.tsx`, recurring section ~2017–2080)
- **Host** row: `Me` by default, plus a searchable list of the calendar's followers (same source as the PlansManager host picker).
- **Repeats** options:
  - Every week
  - Every other week
  - Monthly on the {13th}
  - Monthly on the {2nd Tuesday}
  - Monthly on the {last Tuesday} (only when the chosen date is in the last 7 days of its month)
  - Host picks each date
  - Labels come from the chosen first date. The weekly options are hidden when Host ≠ Me.
- When Host ≠ Me:
  - The first date is optional. Helper text: *"{Name} gets a text to accept. We'll remind them 3 weeks before each date, and skip the month if they don't confirm."*
  - The primary button reads **Send invite**.

### Dashboard (`src/components/PlansManager.tsx`, `PlanDetailModal.tsx`)
- Series row: "Hosted by {Name}" and a status chip. Chips: `Invite sent` · `Active` · `Waiting on {Oct} date` · `Skipped {Oct}` · `Paused: {reason}`.
- Series actions: **Change host**, **Resend invite** (only while `invited`), **Resume** (only while paused), **End series**.
- A proposal waiting on the host shows as a ghost row in upcoming plans ("Wine Club: waiting on {Name} to confirm Tue Oct 13"). It isn't clickable as a plan.

### Host page: new route `src/app/series/[seriesId]/`
Mobile-first and no login, following the `plans/reschedule/[planId]` pattern (server component + client).
1. **Header:** series title, "on {Calendar}", rule label.
2. **Invite state:** Accept / Decline, then the code step.
3. **Next up card:**
   - *Waiting on you:* the date in large type, **Keep this date** (one tap, no code), **Pick another date** (code, then the wall-clock picker from `RescheduleClient`).
   - *Live:* date, `{n} going · {capacity}`, **Move**, **Skip this one**, **Share link**.
4. **Coming up:** rule dates for the next 3 cycles with past skips marked. For information only.
5. **Settings:** time, venue, capacity, description, repeats, "Also update the next one".
6. **End series:** confirm sheet.

The code prompt appears the first time the host tries a protected action and stays valid for the session.

## Jobs
- Add `/jobs/materializeDuePlanSeries`, `/jobs/materializeDueIdeaSeries` and `/jobs/sweepSeriesHostCycles` to `index.js`, with EC2 cron entries through `run-if-leader.sh` at :05, :15 and :25.
- Keep the `jobScheduler.js` entries as backup and make materialization **idempotent**: before creating an occurrence, check whether an EventGroup already has `seriesTemplate = series` and `expiryDate = instant`, and skip if so. Apply the same claim check in `confirmSeriesOccurrence`, so a double tap can't create two.
- Materialize only series with `hostManaged !== true`. Host-managed series create occurrences only through confirmation.

## iOS
No changes. Occurrences are normal plans, and all host actions happen by text and on the web.

## Build order
1. **Server foundations:**
   - `nthWeekdayOfMonth` + rule-date math on `wallTime`/`timeZone`, with unit tests: 5th-Tuesday months, `last`, DST transitions, December→January.
   - New schema fields.
   - `/jobs` endpoints, cron entries, and the idempotency guard (fixes the existing duplicate risk on its own).
2. **Server host flow:**
   - `createPlanSeries` params
   - invite / accept / decline
   - token + host code
   - `sweepSeriesHostCycles` + texts
   - confirm / move / skip / update / end / change host
   - RSVP move text
3. **Portal:** CreatePlanModal host + repeats, then PlansManager series state and actions, then `/series/[seriesId]` host page.
4. **Pilot:** 11 Hoyt Hangouts wine club.

## Open questions
1. Pause after **2** consecutive no-reply skips and tell the owner, or keep skipping indefinitely?
2. Does the host page show attendee names, or only counts?
3. Are the 21 / 10 / 7-day timings right for a monthly club, or do you want less lead time (e.g. 14 / 7 / 5)?
4. Should the owner get a heads-up when a month is skipped, or only see it on the dashboard?
5. Can a series host invite a co-host for their series? (Proposed: not in v1.)

## Out of scope (v1)
Guest payments or cost splitting, several hosts or rotating hosts, host confirmation for weekly/biweekly series, iOS host UI, and host-managed IdeaSeries.
