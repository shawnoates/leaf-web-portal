# Host Assistant — Phase 0 Findings

**Status:** investigation only, no code written. Review gate before Phase 1.
**Date:** 2026-09-01
**Brief:** "Host Assistant: Nudges and Task Approval" (host-only nudges + task approval on follower-hosted plans)

---

## 0. Repo map — read this first

The brief is written as if one repo exists. Three do, and the feature spans all three.

| Repo | Path | Role in this feature |
|---|---|---|
| `leaflets-server` | `~/Developer/Projects/leaflets-server` | **Parse Server 7.5 cloud code.** Approval pipeline, scheduler, task generation, push send, all domain models. The bulk of PRs 2, 4, 5 land here. |
| `leaf-appcode` | `~/Developer/Projects/leaf-appcode` | **iOS app (Swift/ParseCore, UIKit + SwiftUI).** Host checklist UI, notification categories, deep-link routing. PR 3 and half of PR 4 land here. |
| `leaf-web-portal` | `~/Developer/Projects/leaf-web-portal` | **Next.js 16 web portal.** The shared-link plan page and web chat. §8's "2 things to do" hook only. |

Two corrections to the brief's stated assumptions, both load-bearing:

1. **There is no Postgres.** The stack is Parse Server on MongoDB. The §5 DDL (`uuid pk`, `timestamptz`, `jsonb`, index declarations) does not translate directly — it becomes a Parse class defined in `cloud/schema-init.js`, with pointers instead of FKs. Nothing in the design is blocked by this; the schema section just needs rewriting in Parse terms. Uniqueness on `(plan_id, type)` in particular is **not enforceable by the database** — Parse schemas have no unique compound constraint — so it has to be an upsert-by-key discipline in code (there is already a good precedent for this, see §2.4).
2. **The plan chat is not a Parse table.** It is Firebase Realtime Database at `groups/{eventGroupId}/messages`. This has direct consequences for the `kickoff_chat` guard, for message attribution, and for §6's "same transaction" requirement. See §2.5.3.

---

## 1. Findings table

| # | Item from brief | Where it lives | Verdict |
|---|---|---|---|
| 2.1 | Approval state machine + enum | `leaflets-server/cloud/concierge-proposal-functions.js` | **Needs generalization** — recommend *not* reusing (see §2.1) |
| 2.1 | Transition enforcement | Same file, inline guards (no state library) | Reusable as a *pattern*, not as code |
| 2.1 | Auto-approve-on-silence timer | `autoApproveExpiredProposals`, `concierge-proposal-functions.js:659` | Reusable as a pattern; see the cron gap in §2.4 |
| 2.1 | Approver role | Hard-coded to `proposal.get('owner')` | **Owner-specific**, `_requireProposalOwner:51` |
| 2.1 | Audit trail | `transitions` array + `_recordTransition:130` | **Reusable as-is** (copy the helper) |
| 2.2 | Post-first-approval preference capture | `prefsPrompt` flag `:510`, `setConciergeReviewMode` `:578`, field `conciergeReviewMode` | **Needs generalization** — server side is thin and copyable; the UI is web-only and does not exist on iOS |
| 2.3 | Push provider | Parse Server built-in push. APNs `.p8` token auth | **Reusable as-is** (iOS only — Android app is deprecated) |
| 2.3 | Notification categories with actions | — | **Does not exist.** Zero `UNNotificationCategory` in the iOS codebase |
| 2.3 | Action-tap handling | — | **Does not exist.** No `UNUserNotificationCenterDelegate` at all |
| 2.3 | Deep link router | `leaf-appcode/Leaflet/AppDelegate.swift:83`, `PushNotificationManager` | **Reusable, needs a new case** |
| 2.3 | Quiet hours | Ad-hoc per job, hard-coded ET, SMS-only | **Needs generalization** (§2.3.4) |
| 2.3 | Notification bell retirement | `NotificationsBellView.swift` orphaned; `AppNotificationsView` **still wired** | **Incompletely retired** (§2.3.5) |
| 2.4 | Job runner | EC2 cron → HTTP endpoints in `index.js`; `cloud/jobScheduler.js` is the in-memory backup | **Reusable as-is** |
| 2.4 | `trigger_at` table sweep | `sweepVirtualHostPlanUpdates`, `virtual-host-tasks.js:1480` | **Reusable as-is** — this is exactly the sweep shape needed |
| 2.5 | Plan model | `EventGroup` + `EventDetail` pointer | Reusable; **no event end time exists** (§2.5.1) |
| 2.5 | Attendee / RSVP | `EventNotification.status` | **Reusable as-is** — cleanly distinguishes no-response from declined |
| 2.5 | Chat message model | Firebase RTDB, schemaless | Reusable; metadata is trivial to add, but see §2.5.3 |
| 2.5 | Venue model | `DBLocation` via `event.lookupLocations[0]` | **Reusable as-is** — has category, phone, placeId |
| 2.5 | Booking identifier | `virtual-host-booking-window.js` resolves a `bookingUrl` | **Better than expected** (§2.5.4) |
| 2.6 | Compact checklist component | `leaf-appcode` `PlanTaskView.swift` + `PlanChecklistViewModel.swift` | **Reusable, with a naming collision** (§2.6.1) |
| 2.6 | Web plan page | `leaf-web-portal/src/components/Chat/ChatShell.tsx` (route `/chat/[eventGroupId]`) | Reusable; **no host/guest distinction today** |
| 2.7 | Feature flag system | — | **Does not exist.** Nothing generic in any of the three repos (§2.7) |

---

## 2. Detail

### 2.1 Approval pipeline — recommend a parallel machine, not generalization

**The machine exists and is well built.** `cloud/concierge-proposal-functions.js` (1119 lines) implements:

```
draft → concierge_review → owner_review → approved → published
owner_review → changes_requested → concierge_review
```

There is no state gem or library. Transitions are enforced by explicit inline guards at the top of each cloud function — e.g. `ownerApproveProposal:482`:

```js
if (proposal.get('status') !== 'owner_review') {
  throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, `Cannot approve from state ${...}.`);
}
```

The audit trail is `_recordTransition(proposal, from, to, actor, note)` at `:130`, appending `{from, to, actor, at, note}` to a `transitions` array on the row. Actors seen: `'owner'`, `'concierge'`, `'system'`.

Auto-approval on silence is `autoApproveExpiredProposals` (`:659`), a master-key cron that queries `status == 'owner_review' AND ownerReviewDeadline <= now`, flips to `approved`, publishes, and emails. The window is **not** a simple TTL — `_computeDeadline:99` is `min(reviewPeriod, eventDate − leadTime, schedulingWindowEnd)`, where the review period defaults to 3 days (`CONCIERGE_OWNER_REVIEW_PERIOD_DAYS`) and lead time is 2 or 7 days by `eventType`. There is also a tight-window escalation at `:441` that refuses to enter `owner_review` at all when the deadline would already be past.

**The approver is hard-coded to the property owner.** `_requireProposalOwner:51` reads `p.get('owner')` and compares to `request.user.id`. There is no role parameter. Beyond that single function, owner-ness is baked into the surrounding machinery in ways that are worse than the auth check:

- `_emailOwner:186` walks `calendar → parentOrganization` to resolve an **org**, because concierge billing, review mode, and the dashboard deep link are all org-scoped. A follower-host has no org.
- `_postConciergeMessage:139` posts to a `ConciergeMessage` thread that is org-scoped for the same reason.
- Every terminal path calls `_publishProposal` → `_publishPlanOptionToCalendar`, i.e. publishing an event to a building calendar. A host task's terminal action is sending a chat message. There is no shared terminal.
- Notification is email-only. There is no push anywhere in this file.
- `calendarHostingId` / `_settleLeafHostIfReady` couples approval to Stripe capture.

**Recommendation: build a parallel minimal machine. Do not generalize this one.**

The two machines share a shape but almost no behavior. Generalizing means parameterizing the approver role, the notification channel (email vs push), the terminal action (publish-to-calendar vs post-to-Firebase), the deadline formula (lead-time bounded vs relevance-window bounded), and the org resolution (present vs absent) — five injection points through a 1119-line file whose every function currently assumes an org and an owner. That is a rewrite of the concierge pipeline disguised as a refactor, and it puts a revenue-carrying flow at risk to save a state enum.

Rough cost, for the state machine only (not the surrounding feature):

- **Parallel machine:** ~1–2 days. New module, ~250 lines. Lift `_recordTransition` verbatim. Copy the inline-guard idiom and the cron sweep shape. Zero risk to concierge.
- **Generalize in place:** ~4–6 days plus regression risk across concierge proposals, leaf-host Stripe settlement, and the admin portal. The auto-approve cron would then serve two feature areas with different default semantics — and §4 explicitly wants auto-approve **off** by default here, which is the opposite of the concierge default.

What *should* be reused verbatim: the `transitions` audit array, the `_recordTransition` helper, the inline-guard idiom, and the cron-sweep query shape. Those are the parts that carry the institutional lesson; the rest is org plumbing.

**Also note:** the brief's proposed `host_review` state, TTL semantics, and "never resend" rule are all cleanly expressible in a fresh machine, and the terminal `sent`/`done` split for `make_reservation` has no analogue in the concierge machine anyway.

### 2.2 Post-first-approval preference capture

The flow is three pieces:

1. **Trigger** — `concierge-proposal-functions.js:510`:
   ```js
   const prefsPrompt = proposal.get('isFirstProposalForCalendar') === true
     && !calendar.get('conciergeReviewMode');
   return { ok: true, published: true, prefsPrompt, ... };
   ```
   Returned only from the *explicit* approve path. `autoApproveExpiredProposals` deliberately does not set it — a silent approval is not a signal of preference. **Keep that distinction**; it matters more here, where §4 restricts auto-approve to impersonal task types.
2. **Storage** — `Groups.conciergeReviewMode`, a string field declared at `cloud/schema-init.js:997`, values `review_each | auto_proceed | hands_off`. Written by `setConciergeReviewMode` (`:578`). Cleared by `concierge-intake-functions.js:762` on offboarding.
3. **UI** — `leaf-web-portal/src/components/ConciergeProposalCard.tsx`.

**Verdict: needs generalization, and the reuse is smaller than the brief assumes.** The server half is ~20 lines and worth copying rather than sharing — a host's preference is per-host-per-task-type (§4), not a single enum on an org row, so it wants its own storage shape (a map or a small `HostTaskPreference` class), not `conciergeReviewMode`.

The UI half **does not transfer at all**: the existing component is React in the web portal, and the host prompt has to appear in the iOS app. It is a re-implementation in SwiftUI against the same interaction design, not a reuse. Budget for that in PR 3.

### 2.3 Push notifications

#### 2.3.1 Provider

Parse Server's built-in push (`parse-server@7.5.0`, `@parse/push-adapter`), configured at `leaflets-server/index.js:120`:

- **iOS:** APNs token auth, `push/AuthKey_4A34DW47VQ.p8`, teamId `P2Q3GJZDXM`, topic `com.kontrast.leaflets`. Both a `production: false` and a `production: true` provider are registered; the adapter tries them in priority order.
- **Android:** a legacy GCM/FCM server key is still configured, but **the Android app is deprecated** — iOS is the only client that matters for this feature. The stale config is dead weight, not a risk.

Tokens are stored on the standard Parse `Installation` class, registered in `leaf-appcode/Leaflet/AppDelegate.swift:44`, which sets `installation["user"]`, `channels = ["global"]`, and app-version fields. Reachability filtering is centralized in `leaflets-server/helpers/pushReachability.js` (`activeInstallationQuery()`) — **use it**, it is what keeps the send path and the SMS-fallback check from disagreeing.

#### 2.3.2 Categories with actions — the good news and the bad news

**Good news, server side:** no server work is needed. `@parse/push-adapter/src/APNS.js:210` already maps a top-level `category` key straight through to `notification.setCategory()`. So `Parse.Push.send({ data: { alert, category: 'LEAF_HOST_TASK', data: {...} } })` works today with no adapter change.

**Bad news, client side:** the iOS app has *no* notification-action infrastructure whatsoever.

- Zero matches for `UNNotificationCategory`, `UNNotificationAction`, or `setNotificationCategories` across the entire Swift codebase.
- There is no `UNUserNotificationCenterDelegate` conformance and no `userNotificationCenter(_:didReceive:withCompletionHandler:)`. The only push entry point is `application(_:didReceiveRemoteNotification:fetchCompletionHandler:)` (`AppDelegate.swift:27`), which the code itself comments is "Implemented For Silent/Background Notifications Only."

So today every push is tap-to-open, routed by the `switch` on `data["notification_type"]` at `AppDelegate.swift:88`. Action buttons would not merely be unhandled — without a registered category, **iOS would not draw them**.

**Cost to add the two-action category that can approve without launching the app** — roughly 2–3 days of iOS work, and note the "without launching the app" requirement is the expensive half:

1. Register `UNUserNotificationCenterDelegate` at launch and call `setNotificationCategories` with `LEAF_HOST_TASK` (~half a day). Straightforward, but touches app startup, which is currently ParseCore/UIKit — worth care.
2. Implement `didReceive response:` and route `response.actionIdentifier` (~half a day).
3. **Background action without launching the app.** `UNNotificationAction` with `.foreground` unset keeps the app out of the foreground, but the handler still runs in the app process with a short execution budget, and the app may be terminated. A cold-start `Send` therefore has to complete a network round trip in that window. The dependable shape is a **Notification Service/Content extension or a small background-safe API call with a completion handler**, plus server-side idempotency so a dropped call is harmless (§6 already requires idempotency — this is *why*). Budget ~1 day and expect the flakiest testing of the whole feature.
4. Acceptance criterion "Approving from the push notification, with the app fully closed, sends the message and does not launch the app" is **testable but genuinely hard**; it will be the long pole of PR 4.

#### 2.3.3 Deep link router

`AppDelegate.swift:83` unwraps `userInfo["data"]` and switches on `notification_type`. Existing cases show the exact idiom to copy — e.g. `CatchUpPlanVote` → `pnManager.handleCatchUpPlanVoteNotification(eventGroupId:)`. There is also a generic fallback at the `default:` branch that opens `data["url"]` in an in-app browser for any unhandled type.

**Can it open a screen with a sheet already presented?** Yes — `handleCatchUpPlanPostNotification` opens a viewer *sheet*, and `handleRescheduleSuggestionNotification` presents a prompt, so presenting-on-arrival is an established pattern in `PushNotificationManager`. The `Edit` action's "deep link to the plan with the chip sheet presented" is a new case following existing precedent, not new capability.

**Note the routing hole:** the current handler only runs for background/silent delivery. A tap on a *visible* notification is handled by iOS's default open behavior, not by this switch. Adding the `UNUserNotificationCenterDelegate` in step 1 above actually fixes this for all notification types, which is a real side benefit worth calling out.

#### 2.3.4 Quiet hours — exists, but not as a reusable thing

There is no shared quiet-hours helper. There are at least four independent hard-coded implementations, all ET, all SMS-only:

- `cloud/functions.js:37242` (`sendEventPhotoRecapSms`)
- `cloud/functions.js:37482` (`sendAttendeeHostInvites`)
- `cloud/dashboard-functions.js:1813` and `:2068` (gap-fill, via `GAP_FILL_QUIET_START_ET` / `GAP_FILL_QUIET_END_ET`)
- `cloud/dashboard-functions.js:2172` (`assertNudgeQuietHours`, the one with a reusable name)

None of them consult the recipient's own timezone, and none apply to push. §7's "respect existing quiet hours" therefore **has nothing to respect** on the push path — this is a "does not exist" dressed as a reuse. `assertNudgeQuietHours` is the best starting point; extracting it into a shared helper that takes a timezone is a ~half-day job and worth doing as part of PR 4 rather than adding a fifth copy.

Note also that the plan's venue timezone *is* available (`venueTimeZoneOf`, `cloud/virtual-host-helpers.js:318`) and the server already has strong conventions about wall-clock-in-venue-zone (see `leaflets-server/CLAUDE.md`). The host's own zone is the right one for quiet hours, and it is the one we do not currently store.

#### 2.3.5 The notification bell

The brief says the bell is "retired pending audit; do not revive it." The audit result:

- `leaf-appcode/Leaflet/NotificationsBellView.swift` — the view still exists and is **never referenced** anywhere in the codebase. Genuinely dead.
- **`AppNotificationsView()` is still wired**, at `leaf-appcode/Leaflet/PathView.swift:194`, as a live `.AppNotification` route in the app's navigation enum. The in-app notification list is still reachable by anything that pushes that route.
- The backing `AppNotification` Parse class is still actively written by the server — `runPlanReminderJob` (`cloud/functions.js:33150`) saves `AppNotification` rows on every plan reminder fan-out, and it is in the LiveQuery `classNames` list at `index.js:118`.

So: the *bell affordance* is gone, the *inbox behind it* is not. Nothing in this feature needs to touch it, and per the brief nothing will — but "retired" overstates it, and the still-live `AppNotification` writes are relevant to §12's instrumentation (they are a second, parallel record of nudges that this feature would not be writing to).

### 2.4 Scheduler / job runner — reusable as-is, with one gap

**Primary path:** EC2 cron → HTTP. `.ebextensions/cron-jobs.config` writes `/etc/cron.d/leaf-scheduled-jobs`; each line is `run-if-leader.sh curl -X POST -H "X-Cron-Secret: ..." http://localhost:8080/jobs/<name>`. The endpoints are defined in `index.js` (~40 of them, `:362` onward) behind `validateCronRequest`, each of which just calls `Parse.Cloud.run(<name>, {}, { useMasterKey: true })`. `run-if-leader.sh` (`cron-jobs.config:209`) ensures only one instance in the ASG fires.

**Backup path:** `cloud/jobScheduler.js` (1295 lines), an in-memory `node-schedule` mirror, documented at the top of the file as a backup for cron failure and local dev.

Adding a job is mechanical: define the cloud function, add an `index.js` endpoint, add a cron line, and optionally add the `node-schedule` mirror. **Reusable as-is; no new infrastructure needed.**

**Can it sweep a table of rows with a `trigger_at`?** Yes — and there is a direct precedent that matches the brief's design almost exactly. `sweepVirtualHostPlanUpdates` (`cloud/virtual-host-tasks.js:1480`, cron `35 * * * *`) sweeps `VirtualHostTask` rows, re-evaluates them against live plan state, and fires alerts. `_flagOverdueTasks:1439` and `_runBookingWindowAlerts:1394` inside it are precisely the "guard re-evaluated at fire time" pattern §3 demands. The `plan_task` sweep should be modeled on this function, not written fresh.

> **Gap worth flagging:** `autoApproveExpiredProposals` is scheduled **only** in the in-memory backup (`jobScheduler.js:1102`, every 15 min). It has no line in `.ebextensions/cron-jobs.config` — grep for "concierge" or "Proposal" there returns nothing. Since the file's own header calls cron the primary and `node-schedule` the backup, the concierge auto-approval is currently running on the backup path alone. That is a pre-existing concierge issue, not this feature's, but it is exactly the mechanism §4 wants to imitate, and it should be fixed before it is used as a model.

### 2.5 Domain models

#### 2.5.1 Plan — `EventGroup` + `EventDetail`

`EventGroup` is the plan. Relevant fields, confirmed in use:

| Field | Notes |
|---|---|
| `event` | Pointer → `EventDetail` |
| `expiryDate` | **The machine timestamp for when the plan happens.** Derived, and it can drift — see the extended warning in `leaflets-server/CLAUDE.md`. Every reminder cron keys off it. |
| `hostUser` / `user` | The host. Read as `plan.get('hostUser') \|\| plan.get('user')` — both exist and both are used (`functions.js:33418`, `virtual-host-helpers.js:277`). **Two fields for one concept**; `approver_user_id` resolution must use the same fallback or it will silently pick the wrong person on older rows. |
| `publicGroup` | Pointer → `Groups` (the calendar), when the plan belongs to one |
| `capacity` | Number, may be absent (`virtual-host-helpers.js:384`) |
| `cancelPlan` | Boolean — the cancellation guard every cron uses |
| `startTimeZone` | Fallback IANA zone |
| `rsvpReminderSent`, `reminderSent7d`, `reminderSent4h`, `hostHypeSentAt` | Per-plan dedupe flags for existing reminder crons |

`EventDetail` carries `title_event`, `date_event`, `time_event` (wall-clock `"HH:mm"`), and `lookupLocations` / `locations` (arrays of `DBLocation` pointers).

> **`post_recap` has no anchor.** There is **no event end time** anywhere — not on `EventGroup`, not on `EventDetail`. The catalog schedules `post_recap` at "event end + 2h", which cannot be computed. The existing recap job works around this: `sendEventPhotoRecapSms` fires on plans whose `expiryDate` was "≥ 4h ago" — i.e. it assumes a fixed duration. `post_recap` needs the same treatment (pick a constant offset from `expiryDate`) or a new duration field. **This is a spec change, not an implementation detail — flagging rather than deciding.**

Read `leaflets-server/CLAUDE.md`'s `expiryDate` section before writing any `trigger_at` arithmetic. It documents a class of bug (guessed timezone-offset deltas corrupting correct plans by exactly an hour across DST) that this feature is squarely positioned to reintroduce, since every task in §3 is scheduled relative to event start.

#### 2.5.2 Attendee / RSVP — `EventNotification`

One row per person per plan. `status` is the RSVP state, with the full set enumerated at `cloud/functions.js:2082`:

```js
const CHAT_MEMBER_STATUSES = ['Owned', 'Accepted', 'Invited', 'PollInvited', 'Declined'];
```

- `Owned` — the host
- `Accepted` — going
- `Invited` / `PollInvited` — **no response** (this is the `rsvp_nudge` target)
- `Declined` — declined

So yes: no-response and declined are cleanly distinguishable. **Reusable as-is.**

Two gotchas, both already solved in existing code and worth copying rather than rediscovering:

- **Rows are not unique per user.** `fetchVirtualHostRoster` (`virtual-host-helpers.js:275`) documents that one person accumulates several rows across invite → decline → re-invite → accept, and dedupes by user with first-row-wins. Any attendee count in a chip ("3 haven't replied") must dedupe the same way or it will overcount.
- **The host's own row is inconsistent.** `functions.js:33435` notes: "createManualPlan saves it as `Accepted`, iOS path uses `Owned`." Host lookups must use `containedIn(['Owned', 'Accepted'])`.

`EventNotification` also carries `chatOpenedAt` (whether that person has opened the plan chat) and `checklist` (see §2.6.1).

#### 2.5.3 Chat messages — Firebase RTDB, not Parse

Path: `groups/{eventGroupId}/messages`, pushed key per message. Shape, from `postVirtualHostChatMessage` (`virtual-host-helpers.js:143`):

```js
{ message_id, text, from, to, type, timestamp, virtualHost, personaName, personaAvatarUrl }
```

- `from` is a user objectId, or the literal `'leaf_ai'` for assistant/virtual-host messages (`chat-functions.js:695`: `if (msg.from === 'leaf_ai') return 'Leaf'`).
- `type` is `'leafMessage'` for real chat, `'response'` for RSVP system messages; some client-written system messages have no `type` at all and are filtered by content regex (`AUTOMATED_MESSAGE_PATTERNS`, `chat-functions.js:647`).
- It is schemaless, so **adding `draftedBy: 'assistant'` and `planTaskId` is free.** No migration.

Three consequences the brief should absorb:

1. **Message attribution works, and the invisibility requirement is real work.** Writing `from: <hostUserId>` makes the message genuinely the host's — good. But three clients render this node: iOS (`PlanChatView`), the web `ChatShell.tsx`, and the digest emailer (`chat-functions.js`). §5's "never rendered to attendees or the host's chat view" is satisfied by default *only* because none of them read unknown keys today. It should be asserted by test, not assumed.
2. **The `kickoff_chat` guard is a Firebase read, not a Parse count.** "chat message count is still 0" means `db.ref('groups/{id}/messages').once('value')` with the same filtering `fetchUnreadMessagesForChat` (`chat-functions.js:660`) applies — otherwise the icebreaker question that the *creation path itself posts* (`virtual-host-helpers.js:983`, `openInviteQuestion`) will count as a message and the guard will cancel every task. **This is the single most likely silent-failure in PR 2.**
3. **§6's "approve performs the message send inside the same transaction as the state transition" is not achievable.** Parse/MongoDB and Firebase RTDB are separate systems; there is no shared transaction. The honest design is: write the Firebase message first, then transition the Parse row, with the idempotency key making a retry after a partial failure safe. `postVirtualHostChatMessage` already models this — it stamps whether the guest-facing write landed so the record cannot imply a message went out when it did not. Copy that.

Also relevant: the web portal writes to the same RTDB node directly from the browser (`ChatShell.tsx`, `fbPush`/`fbSet`), authenticated via `getChatToken` (`chat-functions.js:423`). There is **no server-side "send a chat message as this user" cloud function** today — PR 3 will need to add one.

#### 2.5.4 Venue — `DBLocation`

Reached via `event.lookupLocations[0]` (fallback `event.locations[0]`). `extractVenueFacts` (`virtual-host-tasks.js:90`) is the canonical reader and already returns exactly what `make_reservation` needs:

```js
{ name, address, phone, categoryAlias, placeId, hasVenue }
```

**Category exists** as `categoryAlias` (comma-joined Yelp aliases, e.g. `"cocktailbars, lounges"`) with `category` as fallback. Better still, `inferPlanType` (`virtual-host-tasks.js:72`) already classifies a plan into `dining | nightlife | activity | ticketed | …` from those aliases with a title fallback. **The `make_reservation` guard ("venue category is restaurant or bar") should call `inferPlanType` rather than inventing a second classifier** — that function encodes hard-won corrections, including a comment about a cinema plan wrongly inheriting the reservation spine.

**Booking identifier:** there is no stored Resy/OpenTable id, but there is something more useful. `cloud/virtual-host-booking-window.js` uses an LLM with Google Search grounding to resolve, per venue, when reservations open and a `bookingUrl` (`:310`), then stamps the window onto the plan. It knows about Resy, OpenTable, Tock, and SevenRooms (`:201`). For §13's open decision 2, **the deep-link-only assumption is already better served than the brief expects** — `bookingUrl` is a solved lookup, not new work.

`DBLocation` also carries `timezone.timeZoneId`, the authoritative zone for all plan-time math.

### 2.6 UI to reuse

#### 2.6.1 The compact checklist — and a naming collision

`leaf-appcode` has:
- `Leaflet/PlanChecklistTask.swift` — a `PlanTask` struct: `{ id, text, isSelected }`
- `Leaflet/SwiftUI ViewModels/PlanChecklistViewModel.swift` (297 lines)
- `Leaflet/Itinerary Views/PlanTaskView.swift` (53 lines) — the compact row: checkbox image, inline-editable `TextField`, trash button

**Verdict: the row component is reusable, but read the following two problems first.**

> **Problem 1 — `PlanTask` is already taken.** The brief's table is `plan_task` and its rows would naturally be `PlanTask` on the client. That name is occupied by an unrelated struct, and `PlanTaskView` is occupied by its row view. The server also already has a `VirtualHostTask` class. Pick a distinct name now — `HostTask` / `HostTaskView` — or PR 3 will be a rename war.

> **Problem 2 — there is already a host checklist, and it is a different thing.** `PlanChecklistViewModel:21` reads `itinerary.eventNotification?.checklist`, and `:42` auto-generates one via `createHostChecklist()` vs `createNonHostChecklist()`. So: an auto-generated, host-specific, per-plan task list **already ships**, stored as a `[{text, isSelected}]` array on `EventNotification`, editable free-text, host-vs-guest aware.
>
> This is not the same feature — it is a personal itinerary checklist with no approval, no scheduling, no push, no server guard. But it occupies the same screen real estate and the same conceptual slot in the host's head. **Shipping a second host checklist next to the existing one needs a deliberate answer** — merge, replace, or visibly separate. That is a product call, flagged not decided.

Also note `PlanTaskView` is built for *editing* (inline `TextField`, delete button). The host-task row is *approval* (tap → sheet with variants). The visual language transfers; the interaction does not. Expect to write a new row view that matches the existing one's styling rather than reusing it directly.

#### 2.6.2 Web plan page

Two distinct routes, and the brief's description matches the second:

- `/p/[eventGroupId]` (`src/app/p/[eventGroupId]/page.tsx`, 260 lines) — the shared-link **RSVP landing** page. `StandalonePlanCard.tsx`, `StandalonePlanRsvp.tsx`.
- `/chat/[eventGroupId]` → `src/components/Chat/ChatShell.tsx` (746 lines) — **this is the "plan detail on the left, chat on the right" view.** It has a desktop plan sidebar (title, date, about, attendees) plus the chat column, with a `hidePlanDetails` prop for embedded use.

**Host-versus-guest distinction today: essentially none.** `ChatShell` has no `isHost` / `hostUser` / `isOwner` logic at all. The only host-awareness in the web plan surface is `StandalonePlanRsvp.tsx:204`, an `isHostResult` flag returned by the RSVP call, used to change one confirmation string.

So §8's "show the task count as a hook behind the existing Open in Leaf app button" requires **introducing** a host check on this surface. It is small — the data is available and there is already an `APP_STORE_URL` / device-detection / QR-code block in `ChatShell.tsx:27-37` to hang it off — but it is new, not a reuse.

### 2.7 Feature flags

**Does not exist.** No flag system in any of the three repos: no `FeatureFlag` class, no flags module, no LaunchDarkly/Statsig/Unleash dependency, no generic env-var gating convention.

The nearest existing thing is a **hand-rolled policy allowlist** in `cloud/leaf-host-helpers.js:48`:

```js
const DEFAULT_LEAF_HOST_POLICY = Object.freeze({
  mode: 'allowlist',   // 'open' | 'allowlist' | 'off'
  cities: ['NYC', 'New York'],
});
```

...stored in a `Config` row, resolved at `:151`, matched case-insensitively against org cities at `:172`. The other cohort concept is `cloud/audience-cohorts.js`, but that is a *content* taxonomy (`moms`, `dads`, `seniors`…) for who a plan is *for* — not a rollout mechanism, and not applicable.

**Recommendation:** copy the `leaf-host` policy shape rather than building a flag system. A `Config` row holding `{ mode: 'off' | 'allowlist' | 'open', hostUserIds: [...] }`, read through one helper, is ~half a day, matches an existing in-repo convention, and gives exactly the cohort scoping §2.7 asks for. Building a general flag system is out of scope for this feature and should be its own decision.

---

## 3. Cross-cutting finding: the nudge budget already has competition

This did not have a line in the Phase 0 checklist, but it materially affects §7 and §14, so it is reported here.

**The plan already sends host and attendee nudges, from at least five independent crons, none of which share a budget:**

| Existing job | When | Who | Overlaps |
|---|---|---|---|
| `sendHostPlanHypeSms` (`functions.js:33390`) | T-23–24h | **The host** | **`kickoff_chat`** |
| `sendPlan7DayReminders` | T-7d | All attendees (push + SMS) | — |
| `sendPlanRsvpReminders` (`:33228`) | T-24h | All attendees (push + SMS) | `rsvp_nudge` |
| `sendPlan4HourReminders` | T-4h | All attendees (push + SMS) | **`day_of_details`** (T-3h) |
| `sendEventPhotoRecapSms` (`:37364`) | end +~4h | Accepted attendees **and the host** | **`post_recap`**, **`thank_you`** |

`sendHostPlanHypeSms` deserves particular attention: it is **already a host nudge, already guarded on chat emptiness**. It fires at T-24h to the host by SMS, skips if `hostNotif.chatOpenedAt` is set, and skips if fewer than 2 attendees have accepted. That is `kickoff_chat`'s guard logic, shipped, in a different channel, at a different time.

Consequences:

1. **§7's "maximum 3 pushes per plan across all task types" is under-specified.** Enforced only across `plan_task` rows, a host on a plan could still receive the 7d, 24h, and 4h attendee reminders plus 3 task pushes plus the hype SMS. The budget needs to either count the existing reminder sends or be honestly relabeled as a per-feature cap.
2. **§14's "A new plan with an empty chat produces exactly one `kickoff_chat` push"** is satisfiable, but the host will still get the hype SMS 24h later on the same premise. Whether `kickoff_chat` should *retire* `sendHostPlanHypeSms` is a product decision worth making before PR 2, since keeping both is close to guaranteed annoyance.
3. There is a per-recipient weekly SMS budget pattern worth copying: `dashboard-functions.js:2197` uses a `weekBucket(now)` + `extraSmsSlotUsed(users, bucket)` + `addUnique('hostNudgeSentWeeks', bucket)` claim, atomic via `addUnique`, checked across linked identities. That is the right shape for §7's per-host-per-task-type skip memory.

---

## 4. Addendum: the `thank_you` task type

Added to scope after Phase 0 review. Recorded here because the existing post-event
machinery constrains how it should be built.

### 4.1 What already happens after a plan ends

The rating request is real, and it is worth being precise about what it is, because
its shape decides what `thank_you` should and should not say.

`sendEventPhotoRecapSms` (`cloud/functions.js:37364`, cron `20 * * * *`) fires on
plans whose `expiryDate` was **≥ 4h ago** and sends **one personal SMS per person**,
carrying a link to that person's recap page. Its own copy states the purpose:

> "add any photos you took so the whole group can see them, and you can rate the plan there too"

Three details that matter:

- **The host receives it too.** The recipient query is `status IN ('Accepted', 'Owned')`
  (`:37437`), explicitly so the host's page renders the Mark Attendance section.
- **It is per-person and link-bearing.** The group chat cannot carry the link, so on
  virtual-hosted plans the job also posts one persona chat message that just says
  "I texted each of you" (`:37419`).
- **Rating lives on that recap page**, not in a push and not in the chat. The in-app
  `FeedbackCardView` ("Rate your experience and add notes for future reference") is the
  other surface, rendered in Plan History from `Feedback` rows written by
  `createPlanHistoryFeedbacks` (`cloud/planHistoryFeedbacks.js:243`, every 6h).

So the post-event sequence today is: **end +4h** — everyone, host included, gets an SMS
asking for photos and a rating.

> **Secondary finding, adjacent but separate.** The `EventGroupMeet` push — the 60-day
> "meet these people again" nudge that deep-links into Plan History — is **dead**. iOS
> still handles it (`PushNotificationManager.swift:697`, `AppNotificationsView.swift:128`),
> but nothing writes it: zero matches for `GroupMeet` anywhere in `leaflets-server`. It was
> sent by the old admin-portal Express cron (`leaf-admin-portal-old/server/cron/EventGroup Meetup/EventGroupRemeet.js:97`),
> which stopped running around 2026-04-29 — the same shutdown that
> `planHistoryFeedbacks.js` was written to recover from. That port restored the `Feedback`
> **rows** but not the **push** that surfaced them. Not this feature's problem; flagging
> because it is a silently broken re-engagement loop sitting in the same window.

### 4.2 Proposed catalog row

| type | scheduled for | guard re-evaluated at fire time | host action |
|---|---|---|---|
| `thank_you` | day after the event, ~10:00 local | ≥ 2 accepted attendees, plan not cancelled, **and the host has posted no chat message since the event ended** | send one of 3 chips |

**"Next day" must be wall-clock, not `end + 24h`.** A dinner ending at 11 PM plus 24 hours
is 11 PM the following night — the worst possible moment for a thank-you. The anchor should
be the morning *after* the event's local calendar day, resolved in the venue's IANA zone via
`venueTimeZoneOf` (`cloud/virtual-host-helpers.js:318`). Read `leaflets-server/CLAUDE.md`'s
`expiryDate` section first — this is exactly the arithmetic that has corrupted plans by an
hour across DST before.

**The "host already thanked them" guard is the important one.** A host who wrote "last night
was so fun" unprompted at 9 AM must not get nudged at 10 AM to do the thing they just did.
That is the same Firebase read as the `kickoff_chat` guard (§2.5.3) — messages since
`expiryDate`, filtered for `from == hostUserId` and real chat types.

**Auto-approve: never.** §4 of the brief restricts auto-approval to impersonal task types.
A thank-you addressed to named friends is the most personal message in the catalog. It joins
`kickoff_chat`, `rsvp_nudge`, and `post_recap` on the never list.

**TTL:** ~48h after the event. A thank-you that lands three days later reads worse than none.

### 4.3 Copy: do not ask for the rating

The chip must be **purely social** — thanks, and optionally a hook to the next plan. It must
not ask anyone to rate anything, and should not ask for photos either. Both are already
covered by an SMS that carried a working link 4 hours earlier, and a host chip repeating the
ask double-prompts the same people for the same thing from a second direction.

Three meaningfully different variants, per §9:
one plain thanks; one naming a specific moment or the venue; one that opens the door to a next plan.
Same rules otherwise — host's first person, under 90 characters, no mention of Leaf, no emoji
unless the host used emoji in that chat.

### 4.4 This forces a decision on `post_recap`

`thank_you` and `post_recap` are now two host-facing post-event nudges on the same plan, and
`post_recap`'s brief-specified content — "prompting split, photos, or the next plan" — is
**two-thirds redundant with the recap SMS**, and arrives at end +2h, i.e. *two hours before*
the SMS that actually provides the photo link. Ordering a prompt ahead of the tool it needs is
backwards.

My recommendation: **drop `post_recap` and keep `thank_you`.** One post-event host touch, the
next morning, doing the one thing no automated system can do — sound like the host. Splitting
the bill is the only element not already covered elsewhere, and it can ride in a variant.

If both are kept, they need an explicit priority under §7's 3-push cap, because post-event
tasks are the last to fire and will be the first starved by a plan that already spent its
budget on `kickoff_chat` and `rsvp_nudge`. In that case `thank_you` should outrank `post_recap`.

---

## 5. Open decisions for Shawn

Carrying forward the brief's five, with what Phase 0 learned, plus four new ones.

**From §13:**

1. **`rsvp_nudge` — chat message or direct push to non-responders?** Chat is genuinely simpler and reuses everything (the RTDB write path, the roster dedupe). Direct-to-non-responders needs a new fan-out but `EventNotification.status IN ('Invited','PollInvited')` makes the targeting trivial, and `helpers/pushReachability.js` makes the send safe. My read: chat for v1, given `rsvp_nudge` is one of the task types where auto-approve is *never* allowed anyway, so the host is always in the loop either way.
2. **Reservation — deep link or booking partner?** Deep link, and it is cheaper than assumed: `virtual-host-booking-window.js` already resolves a `bookingUrl` per venue.
3. **Quiet hours window.** Nothing exists on the push path; four hard-coded ET SMS windows exist. Needs a number *and* a decision on whether it is the host's timezone (not currently stored) or the venue's (available).
4. **Web-only hosts — email fallback or nothing?** Note Mailgun is wired and `_emailOwner` is a working template to copy.
5. **TTL per task type.** No new information; defaults look reasonable.

**New, from Phase 0:**

6. **`post_recap` has no anchor** — no event end time exists anywhere. Fixed offset from `expiryDate` (matching the existing recap job's ~4h assumption), or add a duration field?
7. **Does `kickoff_chat` retire `sendHostPlanHypeSms`?** They are the same nudge on the same guard in different channels. (See §3.)
8. **What happens to the existing per-plan host checklist** on `EventNotification.checklist`? Merge, replace, or run both side by side? (See §2.6.1.)
9. **Does `thank_you` replace `post_recap`, or run alongside it?** (See §4.4 — my read is replace.)

---

## 6. Recommended revisions to the brief before Phase 1

Not a request to change scope — these are places where the brief specifies something the stack cannot do as written:

- §5: rewrite the schema in Parse terms; drop the DB-level uniqueness constraint in favor of upsert-by-key (precedent: `generateVirtualHostTasks`, `virtual-host-tasks.js:676`).
- §6: drop "inside the same transaction." Specify write-Firebase-then-transition with idempotency instead.
- §10 reuse map: change "Approval and review states → add `host_review` as peer of `owner_review`" to a parallel machine (§2.1), and change "Rollout → existing feature flag system" to a `Config`-row allowlist (§2.7).
- §3: add the `thank_you` row (§4.2) and resolve its overlap with `post_recap` (§4.4); schedule any
  surviving post-event task off `expiryDate + constant`, pending decision 6. `thank_you` is anchored to
  local wall-clock the next morning, not a fixed hour offset.
- §4: add `thank_you` to the never-auto-approve list.
- §7: say explicitly whether the 3-push budget counts the existing reminder crons.

---

## 7. Suggested Phase 1 entry point

Unchanged from the brief's PR breakdown, with the following adjustments:

- **PR 2 (model + scheduler)** should model itself on `cloud/virtual-host-tasks.js` end to end — schema in `schema-init.js`, generation with upsert-by-key and prune, sweep on the `35 * * * *` cron pattern — rather than on the concierge proposal pipeline. Lift `_recordTransition` for the audit trail. The riskiest single line in this PR is the `kickoff_chat` guard's Firebase read (§2.5.3).
- **PR 3 (host UI)** carries hidden cost: a new server-side "send chat message as user" cloud function, a SwiftUI re-implementation of the preference prompt (the existing one is React), and a naming decision to avoid the `PlanTask` collision.
- **PR 4 (push)** is the long pole. The server side is nearly free; the iOS side is building notification-action infrastructure that does not exist at all, and "approve without launching the app" from a cold start is the hardest thing in the feature.
