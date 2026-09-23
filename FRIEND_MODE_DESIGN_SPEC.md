# Design spec: Friend Mode ("Leaf keeps your friends seeing each other")

> Status: draft for review, 2026-09-22. Nothing built yet.
> Spans three repos: `leaflets-server/cloud` (Parse Cloud Code), `leaf-appcode` (iOS) and this portal.
> Friend Mode extends Leaf OS. People find Leaf through a neighborhood or community calendar; Friend Mode is how they build and keep their own friend group, including people they met there.

## Overview
A small group (15 people or fewer) turns on Friend Mode and sets a **rhythm**, for example "about once a month." Each cycle, Leaf:

1. Picks a place and 3 dates from what the group has liked before and what's nearby.
2. Asks everyone which dates work, **by text** (reply `1 3`) for people who don't use the app, or **in the app** for people who do.
3. Locks the date most people can make, once enough people are in.
4. Sends one person a booking link, then a day-of reminder.
5. Asks "how was it?" the next day and learns from the answer.

No one has to be the planner, but anyone can be. Any member can text `PLAN` or tap "Plan something" to have Leaf find a night, or propose their own place and dates. Leaf handles the counting and reminders either way.

Friend Mode is **free**. The long-term revenue is venues paying for groups Leaf sends them. v1 only records that data.

## Decisions (from review, 2026-09-22)
| Question | Decision |
|---|---|
| Scheduling | **Rhythm plus a date poll** each cycle. There's no fixed standing night, because friends' schedules change. |
| Business model | **Free for friends. Venues pay later** (featured picks, group booking deals). v1 records venue, headcount and date per night. |
| Calendar type or mode? | **A mode on any calendar with 15 members or fewer.** A brand-new friend group is a small private calendar with the mode on. Bigger calendars don't get the mode. Their members "start a crew from people you met" instead. |
| How members reply | **SMS for quick replies** (`IN`, `OUT`, date numbers, `PLAN`, `PAUSE`) **plus a personal link** for anything else. Free-text understanding (Gemini) comes in phase 4. |
| UI | **iOS plus a light no-login web page.** No org dashboard for friend groups. |
| SMS provider | **Twilio SMS on a dedicated Friend Mode number**, sent through a swappable channel layer. iMessage (Sendblue, Linq) costs $100–1,000 per line per month, against about $0.50–1 per crew per month on Twilio. |
| Naming | Product: **Friend Mode**. Internal and code name for a group: **crew**. |
| Booking | **Leaf sends the night's host a booking link.** Leaf doesn't book. Plenty of products plan for free, so Friend Mode earns its money on the venue side, and the booking link is where that money comes in later (partner links, featured picks). |
| Where places come from | **The Crew Book:** a shared web list of places the group wants to go. Each member sees their own saved places and adds any of them to the crew in one tap. Leaf picks from the book first. Saying which neighborhood you're usually in is optional. `homeArea` is worked out from the spots and past nights, not asked for. |
| Who can start a plan | **Any member who's in.** Two ways: ask Leaf to find a night ("Plan something" or text `PLAN`), or propose your own ("I've got one": pick the place and 1–3 dates). Leaf runs the counting and texting either way. The person who proposes hosts that night and gets the booking link. |
| App users | **Every cycle happens in `PlanningChatView`.** Each cycle is a `PlanningSession` (`sourceType: "crew"`) with the members who are app users as participants. Leaf posts its messages and the date poll there. SMS members' votes appear live in the same poll. There's no separate crew chat. |
| On /me | **Crew nights are plans in "Your plans."** Open votes and invites sit under the hero, and a "Your crews" rail sits on the right. Friend calendars are left out of "Calendars you follow" and "Manage your calendars." |

## What exists today (and the gaps)
- **Date polls that become plans already exist.**
  - `createCalendarDatePoll` (`functions.js:36747`) makes an `EventGroup` with `isPollPlan: true` and a `CatchUpPlanPost` (`isDatePoll`, `pollSource: "calendar"`, `dateTimeOptions`).
  - Votes are `CatchUpPlanVote` rows (`submitCalendarPollVote`, :37217). They're OTP-gated on the web.
  - `closeAndConvertPoll` (:37419) promotes the same `EventGroup` to a real plan and texts the voters.
  - Web voting is at `/poll/[id]` (`PollVoteClient.tsx`). iOS shows these polls in the Planning Hub.

  **Friend Mode reuses the object shapes, not the functions.** `cloud/friend-mode/crew-poll.js` creates the same EventGroup / CatchUpPlanPost / CatchUpPlanVote / PlanningSession rows (with `pollSource: "friendMode"`, `isOpenInvite: false`, `webRsvpEnabled: false`), so iOS and the web plan pages work unchanged, while the calendar-poll functions keep zero behaviour change. Why not extract: those functions bundle owner/co-host auth, a paid-tier gate and follower SMS blasts, none of which apply here. The gaps the separate module covers:
  - All three functions require `request.user` to be the owner or a co-host. They need internal versions Leaf can call.
  - Create and convert text all followers or voters with `sendSms`. For friend calendars they must go through `reachCrewMember` instead.
  - Voting needs an OTP. Friend Mode votes arrive either from a verified phone number (a Twilio inbound text) or through a signed member link.
- **Inbound SMS is dropped.** `/twilioInboundSms` (`index.js:302`) only mirrors STOP/START. `YES` is a START keyword, so Friend Mode needs **its own number** and webhook.
- **The shared 2-texts-per-week ceiling** (`extraSmsSlotUsed`, `dashboard-functions.js:2526`) is for promos. Friend Mode texts are transactional and requested by the member, so they get their own cap.
- **Push vs SMS:** `isPushReachable` (`host-task-functions.js:803`) and the `reachHost` cascade (`series-host.js:404`) are the patterns to copy.
- **People known only by phone** are `_User` rows (`rsvpToPlanViaWeb` :23547, `createNewUsersForContacts` :1861), merged with app accounts by `identity-resolver.js`.
- **Venue picking:** Gemini 2.5 Flash plus Google Places grounding (`_groundVenueOnPlaces`, `ai-calendar-functions.js:1893`), Yelp nearby (`concierge-proposal-functions.js:872`).
- **Memory signals:** `EventAttendeeSurvey`, `Feedback`, `LikedSpot`, mem0 relationship prefs, and the `/m/` photo recap (`sendEventPhotoRecapSms` :39599).
- **Calendar-wide features that must skip friend calendars:**
  - follower fan-out (EventGroup afterSave :4335, `notifyFollowersOfNewPlan`)
  - the weekly digest
  - discovery and search
  - leaderboards
  - plan limits
  - `/org` and `/cal` pages

## Model

### Friend Mode is a mode, stored on the calendar
**`Groups.friendMode`** is an object. Absent or `enabled: false` means off.

| Field | Type | Notes |
|---|---|---|
| `enabled` | boolean | |
| `origin` | string | `friends`: created as a friend group. `calendar`: switched on for an existing small calendar. |
| `status` | string | `active`, or `paused` (by any member texting `PAUSE`, or by the owner) |
| `rhythmDays` | number | Target days between nights. Choices: 7, 14, 21, 28 (default), 42, 56. Timing scales with it (`rhythmTiming` in `crew-schedule.js`): weekly crews start the next cycle 2 days after a night and get dates 4–9 days out; biweekly 5 days after and 5–12 days out; everything longer starts 12 days before the target and gets dates 7–14 days out. |
| `timeZone` | string | IANA zone. Defaults to `calendarTimezone(calendar)`, then `America/New_York`. |
| `homeArea` | object | `{lat, lng, radiusMi}`. **Derived, not asked for.** It's recomputed from Crew Book places and past crew venues, weighted to recent ones. Before any exist, it uses each member's optional "usually around" neighborhood. For `origin: "calendar"`, it uses the calendar's own location. |
| `quorum` | number | Default 3, and never more than half the members, rounded up |
| `ideaCapDays` | number | Default 14. Minimum days between cycles Leaf starts on its own (phase 4). |
| `profile` | object | Leaf's summary of the group: `likedPlaces[]`, `dislikedPlaces[]`, `cuisines[]`, `priceBand`, `dayWeights {0–6: 0–1}`, `notes[]` |
| `lastNightAt` | date | Set when a cycle reaches `done` |
| `enabledAt`, `enabledBy` | | |

**Size limit:** turning the mode on, and adding a member while it's on, are refused above 15 accepted members (`FRIEND_MODE_MAX_MEMBERS = 15`).

**Friend calendars** (`origin: "friends"`) are `Groups` rows with `isPrivate: true`. They have no public page and no followers beyond the members. `isFriendCalendar(cal)` is true only for this origin. A community calendar that switches the mode on keeps all its normal behavior.

### Members
Members are `GroupMembership` rows on the calendar. New fields:

| Field | Notes |
|---|---|
| `fmStatus` | `invited` → `in` / `declined` / `left` |
| `fmJoinedVia` | `sms`, `app` or `web` |
| `fmInvitedBy` | pointer to `_User` |
| `fmConsentAt` | Set when they reply `IN` to the invite, or accept in the app. **Leaf sends nothing else until this is set.** |
| `fmOptedOutAt` | Set by `STOP` on the Friend Mode number, or by leaving |
| `fmLastInvitedAt` | Enforces one invite per person per 30 days |
| `fmLastReplyAt` | |

### The Crew Book: a shared list of places, on the web
Each crew has one shared **Crew Book**: the places the group wants to go. It's a web page that every member reaches from a link (texts, /me, the app). This is where places come in. Nobody texts links to Leaf.

**The page:** `/crew/[token]/book`, or `/crew/[id]/book` when signed in, has two sections:
1. **{Crew}'s book (shared):** every place in the book with its photo, neighborhood and category, "added by Jess", a "Tried ✓ Oct 9" badge once the crew has gone, and 👍 from members. You can sort by *Most wanted* (👍 count) or *New*. Only the person who added a place, or the crew owner, can remove it.
2. **Your saves (only you see this):** the member's own saved places (`LocationBookmark` with `isBookmarked: true`, the same list as the iOS Saved tab, spot probes and "Interested" on /me). Each one has a **one-tap "Add to {Crew}"** button. Places already in the book show "In the book ✓". If you're in several crews, the button opens a crew picker.

At the top, a **search box** (Places autocomplete) adds a new place in one step. It goes into the Crew Book **and** into your own saves.

**Rules:**
- **Your saves are never shared automatically.** Nothing moves from someone's personal saves into the book without that person tapping "Add." Other members never see anyone's personal saves.
- **Empty state:** for phone-only members with no saves yet, show the search box plus "From your crew's past nights" (venues already visited, ready to 👍).
- **What Leaf does with the book:**
  - Adds a crew's venue to the book (marked "Tried") after each `done` night.
  - A 👎 on the recap (F10) hides that place from picks. It stays in the book.
  - The proposal credits whoever added the place: "Sal's, from Jess's list." That gives people a reason to add more.

**Storage: new class `CrewSpot`**, separate from personal bookmarks, so removing a personal save doesn't change the crew's book:

| Field | Notes |
|---|---|
| `crew` | pointer to `Groups` |
| `location` | pointer to `Location` (Places-grounded via `findOrCreateLocationForVenue`) |
| `addedBy` | pointer to `_User` |
| `sourceBookmark` | the member's `LocationBookmark`, if it was added from "Your saves" |
| `upvotes` | array of user ids |
| `triedAt`, `triedCycle` | set when a crew night happens there |
| `hidden` | true after a 👎 recap, or when the owner removes it |

Unique on `(crew, location)`, enforced by upsert in code. When a new place is added through search, the server also calls `upsertBookmarkFromImport(user, location, {source: "friend_mode", sourceCalendarId: crewId})`, which means adding `friend_mode` to `VALID_SOURCES` in `weeklyRecommendations-hooks.js`.

**Server functions** (all take either a member token or a session, and never return anyone else's personal saves or phone number):
- `getCrewBook({crew})` returns the shared list and the caller's own saves, with `inBook` flags.
- `addToCrewBook({crew, locationId | bookmarkId | placeId})`
- `removeFromCrewBook({crew, spotId})`
- `toggleCrewSpotUpvote({crew, spotId})`

**How members get to the book:**
- the F14 welcome text
- a "Add places to the book" link under every poll (F2)
- /me (the "Your crews" rail and the crew page)
- the iOS crew screen (a native list reading the same functions)

**Optional neighborhood:** when joining, a member can answer "Where are you usually around?" (optional). It's used only until the book has places.

### `CrewCycle` (new class): one per night Leaf tries to make happen
| Field | Notes |
|---|---|
| `crew` | pointer to `Groups` |
| `trigger` | `rhythm` (Leaf, on schedule), `member_ask` (a member asked Leaf to plan), `member_proposal` (a member proposed their own place and dates) or `opportunity` (phase 4) |
| `startedBy` | pointer to `_User`, or null when Leaf started it |
| `host` | who hosts the night and gets the booking link: the proposer for `member_proposal`, otherwise the member who asked, otherwise the crew owner |
| `planningSession` | pointer to the `PlanningSession` app members use for this cycle (see "App users: the planning chat") |
| `state` | `picking` → `polling` → `locked` → `booked` → `done`, or `skipped`. Any state before `done` can move to `cancelled`. |
| `venue`, `backupVenue` | `{name, placeId, address, lat, lng, bookingUrl?, phone?}` |
| `pollEventGroup` | the `EventGroup` made by the internal date-poll create (`isPollPlan: true`). The same id becomes the plan on lock. |
| `dateOptions` | mirrors the poll's `dateTimeOptions` (3 options) |
| `chosenOption` | `{date, time}` |
| `rsvps` | `{userId: "in" | "out"}` after lock |
| `headcount` | at `done`, for venue attribution |
| `pollClosesAt` | poll send time + 48h |
| `transitions` | audit trail, `[{from, to, at, by, reason}]`, copying `_recordTransition` |

Votes stay in `CatchUpPlanVote` (no second copy).

**Open-cycle limits:**
- At most **2 open cycles per crew** (open means `picking`, `polling` or `locked`), and **1 per member** they started. Past that, starting another returns "There's already a night being planned, want to join that one?" with a link.
- **A Leaf rhythm cycle never starts while any other cycle is open.** Any `done` night, including a member's own, resets `lastNightAt`, so Leaf doesn't pile a night on top of one a friend just planned.
- These rules are enforced in code (query, then upsert), since Parse has no unique compound constraint.

### `CrewMessage` (new class)
A log of every Friend Mode message on any channel: `crew`, `member`, `cycle?`, `channel` (`sms`, `push`, `chat`, `web`), `direction` (`in` / `out`), `body`, `intent` (`vote`, `in`, `out`, `plan`, `pause`, `resume`, `booked`, `unknown`), `trigger`, `smsLogId?`. This is the context for phase 4's AI reading and the support audit trail.

## Lifecycle

### 1. Create
- **iOS:** Profile or the Home card → "Start Friend Mode." Enter a name, pick friends (contacts, or people you've met; see Growth), pick a rhythm and an area.
- **Web:** for someone who doesn't use the app, starting from `/me` ("Start a crew"), `/friends`, or a Friend Mode CTA on `/m/` or `/p/`. All of these go to `/crew/start`:
  1. Enter a name and a rhythm (every week to every 8 weeks).
  2. Add friends (names and numbers).
  3. Add a spot or two (optional).
  4. Verify your own phone with the existing `requestOTP` / `verifyOTP`, unless already signed in on /me.

  There's no location step. A new friend group has no location until it has spots or nights.
- **From an existing calendar:** the "Turn on Friend Mode" toggle (below). The calendar's location seeds `homeArea`.
- **Server:** `createFriendCrew({name, rhythmDays, invitees[], spots?[], usuallyAround?})` creates the calendar, the owner's membership (`fmStatus: "in"`, `fmConsentAt: now`), and an invite for each friend.

### 2. Invite and consent
- **Phone-only friends** get text F1. `IN` sets `fmStatus: "in"` and `fmConsentAt`. `OUT` or `STOP` sets `declined` / `fmOptedOutAt`. No reply means Leaf sends nothing more; one reminder (F1b) goes out after 3 days, then it stops.
- **App users** get a push plus an in-app accept card. Accepting counts as consent.
- **The inviter** sees "invited" until the person joins. A decline is never shown as a decline.
- **The first cycle** starts once there are `quorum` members who are in.

### 3. Cycle (hourly sweep, `/jobs/sweepCrewCycles` at :35)
- **Start: three ways, all ending in the same poll → lock → book flow.**
  - **Rhythm (Leaf):** a crew with no open cycle and `status: active` starts one when `now ≥ (lastNightAt ?? firstQuorumAt) + rhythmDays − 12 days`.
  - **Ask Leaf (`member_ask`):** any member who's in texts `PLAN`, taps "Plan something" in the app, or uses the button on `/crew/[token]` or /me. Leaf picks the place and dates, as below. The first message credits them: "Jess asked me to find a night."
  - **Propose your own (`member_proposal`):** any member who's in taps "I've got one" in the app or on `/crew/[token]`, picks a place (Crew Book or search) and 1–3 dates and times. It skips the Pick step.
    - With **1 date**, it goes straight to `locked` with the proposer as the only one in, and everyone else gets F4b-style IN/OUT.
    - With **2–3 dates**, it's a normal poll.
    - Proposing by text isn't supported in v1 (it needs free-text reading). The F2 and PLAN replies link to the proposal form.
- **Permissions:** on a Friend Mode calendar, every member who's in can create plans through the Friend Mode functions (`startCrewCycle`, `proposeCrewNight`), which check `fmStatus: "in"` instead of owner or co-host. They get **no** other calendar powers: no editing others' plans, no settings, no removing members.
- **Pick (`picking`):**
  - **Candidates, in priority order:**
    1. Crew Book places the crew hasn't tried, ranked by 👍 count.
    2. Tried Crew Book places with a good recap, but not the last 2 venues.
    3. `likedPlaces` and past crew venues with a survey rating of 4 or more.
    4. Places near `homeArea` that fit `cuisines` and `priceBand`.
  - Gemini ranks up to 8 of these. Everything is grounded with Places.
  - Leaf avoids the last 2 venues and anything in `dislikedPlaces`, and keeps a primary and a backup.
  - **Dates:** 3 options 7–14 days out. It picks the highest-`dayWeights` weekdays, spreads them over at least 2 different weekdays, uses the group's usual time (default 7pm), and skips dates any member has said don't work.
- **Poll (`polling`):**
  - Created by `createDatePollInternal({calendar, title: "{Crew} night", options, venue, closesAt, source: "friendMode"})`.
  - Each member who's in gets F2 through `reachCrewMember`.
- **Nudge:** at 24h, members who haven't voted get F3 (max once).
- **Lock:** at `pollClosesAt`, or as soon as every member who's in has voted:
  - The winner is the option with the most votes that reaches `quorum`. Ties go to the earlier date.
  - `convertPollInternal(eventGroupId, winner, {notify: "crew"})`: voters for the winner become `Accepted` `EventNotification`s.
  - Everyone else who's in gets F4, `IN` / `OUT`.
  - The state becomes `locked`.
- **No quorum:** send F5 with the backup venue and 2 new dates, once. If that also misses, F6 and `skipped`; the next cycle starts on rhythm.
- **Book:**
  - Right after lock, the cycle's `host` gets F7 with the booking link (Resy or OpenTable search deep link, or the venue's phone), in the planning chat if they're an app user, otherwise by text.
  - `BOOKED` moves the state to `booked` and sends F8 to everyone who's in.
  - No `BOOKED` within 48h leaves the state at `locked`. The plan still stands; people just go.
- **Day of:** F9 at 10am local to everyone who's in.
- **Day after:** the existing photo recap (`/m/`) plus F10.
  - A 👍 or 👎 reply, or the survey, updates `profile`. The venue goes to `likedPlaces` or `dislikedPlaces`, and the winning weekday gets a higher `dayWeights`.
  - Then `done`, and `lastNightAt` and `headcount` are set.

### 4. Pause, leave, end
- `PAUSE` from any member pauses the whole crew and sends F11 to the others. `RESUME` from any member restarts it.
- `STOP` opts that one person out (Twilio handles it; we mirror it to `fmOptedOutAt`).
- The owner can remove members or end Friend Mode in iOS or on the web page. Past plans stay.

## Reaching members (`reachCrewMember(member, message, {trigger})`)
1. If the member is opted out or has no consent yet, send nothing (except the single invite text).
2. **App user:** if `isPushReachable(user)` is true and the app was opened within 14 days, the message goes **into the cycle's planning chat** (see below), and they get the existing `planning_message` push with `sessionId`, which already opens `PlanningChatView`. If there's no response after 24h on a message that expects one (a vote, IN/OUT), send one SMS fallback with the `leaf://planning/{sessionId}` link.
3. **Otherwise, SMS** from `FRIEND_MODE_TWILIO_NUMBER`, through `crewChannel.send`, which wraps `sendSmsTracked` with the `fm*` trigger names. The send is held until `nextQuietWindowOpen` if it falls outside 9am–9pm local.
4. **Cap:** 3 texts per member per week across all their crews (5 for members of a weekly crew, since one cycle is poll + lock + reminder), tracked with `fmSmsWeeks` on the user, the same bucket approach as `weekBucket`. Invites, F2 and F4 are always allowed; nudges and reminders are dropped first.
5. Every send writes a `CrewMessage`.

## App users: the planning chat
For members who are active app users, **each cycle happens in `PlanningChatView`**, the same Planning Hub chat used for group hangouts today. There is no separate crew chat.

**Most of this already works:**
- **A poll on a calendar can already have a planning chat.** `createCalendarDatePoll` already creates a `PlanningSession` with `convertedGroup` set to the poll `EventGroup` when the host has an app account (`functions.js`, step 4b).
- **The chat already recognizes poll plans.** `PlanningChatViewModel.isPollPlanSession` treats such sessions as poll plans: it seeds the Firebase `ChatPoll` from `CatchUpPlanPost.dateTimeOptions` (`importExistingPollPlanOptions`), imports existing votes (`importExistingPollPlanVotes`), and **live-queries `CatchUpPlanVote`** (`subscribeToCatchUpPlanVoteUpdates`, :875). SMS members' votes therefore show up in the chat as they arrive.
- **Members see sessions they're part of.** The Planning Hub loads sessions where you're the creator **or** a participant (`loadActiveSessions` → `fetchActiveSessions` + `fetchSessionsAsParticipant`), so every member who's in sees the cycle.
- **The server already posts to planning chats.** It writes Leaf messages and polls to `planning_sessions/{firebaseId}/messages` and `/polls` (`insertChatMessage`, `sendReEngagementStraggler` in `forYouGroupFunctions.js`), and the `planning_message` push deep-links into the chat.

**What Friend Mode adds:**
- **Cycle start:** `createDatePollInternal` always creates the `PlanningSession` for a crew cycle with:
  - `sourceType: "crew"` (a new `SourceType` case on iOS)
  - `creator` = `startedBy`, or the crew owner when Leaf started it
  - `participants` = every member who's in and has an app account (whether or not they're active; the session is where the plan lives)
  - `chatName` = "{Crew} · {Venue}"
  - `aiContextData.crewId` and `aiContextData.crewCycleId`
  - `host`
- **Leaf's messages** (`from: "leaf_ai"`) replace the texts for app users, one per step: the proposal with a Crew Book credit ("Sal's, from Jess's list"), the nudge, "Locked for Thu 10/9, 5 going", the booking link for the host (with a **Booked** button that calls `markCrewBooked`), day-of and recap. Copy matches F2–F10 without the "reply 1 3" instructions.
- **Everyone else's messages stay in the chat.** App members chatting to each other is normal planning chat. Leaf does **not** forward chat messages to SMS members (same privacy rule as free-text texts), and SMS members' free-text never appears in the chat.
- **In-chat votes must write `CatchUpPlanVote`**, the source of truth the cycle engine counts. *Verify in Phase 1* that voting in a poll-plan chat already writes it (`CatchUpPlanVote.fetchMyVote` is used at `PlanningChatView.swift:3581`). If it doesn't, add a `recordPollVote` call from the chat's vote action.
- **After lock:** the session is set to `status: "completed"` and `selectedDateTime`, as `closeAndConvertPoll` does today. The night then continues in the normal plan chat (`groups/{eventGroupId}/messages`).
- **Expiry:** crew sessions are left out of `sendPlanningSessionExpiryReminders` and `cleanupStaleForYouSessions`. The cycle engine owns their lifetime.
- **Starting a cycle in the app:** "Plan something" and "I've got one" call `startCrewCycle` / `proposeCrewNight`, then open the new session in `PlanningChatView`.

## Inbound SMS
**New route:** `/twilioFriendModeInbound` on the dedicated number. It checks the Twilio signature, like `/twilioInboundSms`.

**Parser (`crew-reply-parser.js`)** is deterministic and case-insensitive. Emoji are normalized first.

| Reply | Intent |
|---|---|
| `IN`, `Y`, `YES`, 👍, `I'M IN` | `in` (joins the crew if invited; otherwise RSVP in) |
| `OUT`, `N`, `NO`, 👎, `CAN'T` | `out` |
| `1 3`, `1,3`, `13`, `1 and 3`, `all` | `vote` for options (only when a poll is open and each digit is 1–3) |
| `PLAN` | start a cycle now |
| `PAUSE` / `RESUME` | pause or resume the crew |
| `BOOKED` | the owner confirms the booking |
| `STOP` / `START` | Twilio handles these; mirrored to `fmOptedOutAt` |
| `stop texting me`, `leave me alone`, `remove me`, `unsubscribe`, `quit`, `cancel`, `end`, `opt out`, `revoke`, `who is this`, `wrong number`, profanity aimed at Leaf (`f*** off`) and similar | `optout` (see below). **Checked before every other rule.** |
| anything else | `unknown`: logged, then reply F12 |

### Opt-outs in the member's own words
The Twilio STOP keywords aren't enough. Under the FCC consent-revocation rule (in force since April 11, 2025), a person can revoke consent "by any reasonable means," so "stop texting me" or "remove me" counts as STOP. We must stop within 10 business days; we do it right away.

- **The opt-out check runs first,** before the IN / OUT / vote rules. It's a deterministic phrase and profanity list in `crew-reply-parser.js`, case- and punctuation-insensitive, tested against a fixture set. A match on any rule wins, so "no stop texting me" is an opt-out, not an OUT.
- **When in doubt, it's an opt-out.** Anything confused ("who is this?", "wrong number") or aimed at Leaf ("f*** off", "go away") is treated as an opt-out. Profanity on its own ("holy s*** can't wait") is not: it stays `unknown` and is flagged for review. Wrongly stopping someone costs a friend a re-join text. Wrongly continuing is a compliance problem and makes Leaf a pest.
- **What happens:**
  1. Set `fmOptedOutAt` on **every** Friend Mode membership for that phone, and add the number to a `FriendModeSuppression` list so it survives membership changes and re-invites. They are **not** re-invitable from any crew until they text `START` or `JOIN`.
  2. Send **one** confirmation, F16, straight away (a single confirmation right after an opt-out is allowed). Then nothing more.
  3. Open cycles drop them from quorum. Their votes are removed from any open poll.
- **What the crew sees:** "{Name} left." Never the message, never the reason. The inviter is not told it was an opt-out, and it's never shown as a decline.
- **Human review:** hostile or abusive texts, and anything that looks like distress (self-harm, threats), go into a `CrewMessage` review queue for a person at Leaf (`flagged: true`), with a Slack or email alert. Leaf never argues, jokes back or follows up on these.
- **Phase 4:** the Gemini classifier adds a `revocation` intent for looser wording ("I'm done with this", "please don't message me"). **The deterministic list stays in front of it**, so an LLM outage or mistake can never keep texting someone who asked to stop.

`YES` is safe here because Advanced Opt-Out keywords on this number are configured with `START` / `UNSTOP` only.

**Which crew a reply is for:**
1. Resolve the phone through `identity-resolver`.
2. Find that person's crews with an open item they need to answer: a pending invite, an open poll, a locked RSVP or a pending booking.
3. If there's exactly one, apply the reply to it.
4. If there's more than one, send F13 ("Which crew? 1) … 2) …") and keep a 30-minute pending context in `CrewMessage`.

**Votes by SMS** upsert the `CatchUpPlanVote` with a new internal `recordPollVote(pollPost, user, selectedOptions, {source: "sms"})`. The phone is already verified by Twilio, so no OTP.

## Texts
Trigger names are for `SmsLog`. All texts come from the Friend Mode number, start with the crew name, and respect quiet hours.

| # | Trigger | Copy |
|---|---|---|
| F1 | `fmInvite` | {Inviter} added you to {Crew} on Leaf 🍃 Leaf finds a night that works for everyone and handles the planning. Reply IN to join. Reply STOP to opt out. |
| F1b | `fmInviteReminder` | {Crew}: {Inviter} and {n} others are in. Want in? Reply IN. |
| F1c | `fmInviteMet` | {Inviter} from {Community calendar} wants to add you to {Crew}, a small group Leaf plans nights for. Reply IN to join. |
| F2 | `fmPoll` | {Crew}: next night at {Venue}. Which work? 1) {Thu 10/9} 2) {Sat 10/11} 3) {Tue 10/14}, 7pm. Reply with numbers (like 1 3) or OUT. {link} |
| F3 | `fmPollNudge` | {Crew}: {n} people have voted. Which nights work for you? Reply 1, 2, 3 or OUT. |
| F4 | `fmLocked` | {Crew} is on: {Thu 10/9, 7pm} at {Venue}, {n} going. You in? Reply IN or OUT. |
| F4b | `fmLockedVoter` | Locked: {Thu 10/9, 7pm} at {Venue}. {n} going. {link} |
| F5 | `fmRetry` | {Crew}: those dates didn't work for enough people. Try {Backup venue}? 1) {date} 2) {date}. Reply numbers or OUT. |
| F6 | `fmSkipped` | {Crew}: no night this round. I'll check back in a few weeks. Text PLAN anytime. |
| F7 | `fmBookAsk` | {Crew} locked for {Thu 10/9, 7pm} at {Venue}, {n} people. Book here: {bookingLink}. Reply BOOKED when it's done. |
| F8 | `fmBooked` | Booked ✅ {Venue}, {Thu 10/9, 7pm}, under {Owner first name}. {address} |
| F9 | `fmDayOf` | Tonight: {Venue} at 7pm. {n} going. {mapsLink} |
| F10 | `fmRecap` | How was {Venue}? 👍 or 👎. Photos here: {recapLink} |
| F11 | `fmPaused` | {Member} paused {Crew}. Text RESUME to start it again. |
| F12 | `fmUnknown` | Got it, I'll pass that along. See or change your answer: {link} |
| F13 | `fmWhichCrew` | Which crew is that for? 1) {Crew A} 2) {Crew B} |
| F14 | `fmWelcomeBook` | Welcome to {Crew}! Add places you want to go to the crew's book, and I'll plan nights around them: {bookLink} (Sent once, right after joining.) |
| F17 | `fmKickoffProgress` | {n} of {total} joined {Crew}. Waiting on {k} more before I plan the first night. Add people: {link} |
| F18 | `fmKickoffStalled` | Still waiting on {k} more for {Crew}. Add a few more people ({link}), or reply START to plan with the {n} who are in. |
| F19 | `fmKickoffGaveUp` | Nobody new has joined {Crew}. I'll hold off until you add more people: {link} |
| F16 | `fmOptOutConfirm` | You won't get any more texts from Leaf Friend Mode. Text JOIN anytime to come back. |

`{link}` is the member's personal `/crew/[token]` link.

## Keeping friend calendars out of calendar-wide features
Add `isFriendCalendar(groups)` (in a shared helper, for example `cloud/friend-mode-helpers.js`). Check it in:
- the EventGroup afterSave follower fan-out (`functions.js:4335` / `notifyFollowersOfNewPlan`)
- `sendWeeklyPlanDigest`, discovery and search queries, leaderboards
- plan-limit checks (friend calendars don't count toward the owner's calendar or plan limits)
- `createDatePollInternal` / `convertPollInternal`, which skip the follower SMS blast when `notify: "crew"`
- the portal: `/org/[shareId]` and `/cal/[slug]` return 404, and `/dashboard` lists friend calendars separately under "Friend Mode"

## Turning Friend Mode on for an existing calendar
- **Who sees the option:** owners of calendars with 15 members or fewer see "Turn on Friend Mode" (dashboard Settings, iOS calendar settings). Bigger calendars see "Start a crew from people you met" instead.
- **Consent:** switching it on sends each member F1-style consent (push or text). Only members who say IN get polls.
- **Normal behavior stays:** posting plans, followers and the public page keep working as before.

## Growth: from community calendar to Friend Mode
- **Add people you met:** `inviteToFriendMode({crewId, userId})` succeeds when the caller and the invitee both have an `Accepted` `EventNotification` on at least one shared `EventGroup`, or the invitee is in the caller's `UserContact`s.
  - Only names are ever shown.
  - The invite is F1c or a push.
  - One invite per person per crew every 30 days.
  - A decline shows as "invited".
- **"People you keep seeing":** `getFriendModeSuggestions()` returns groups of 2–5 people who've attended 2 or more plans with the caller in the last 90 days (co-attendance counts, `fetchPastCluster` for app users). Names and avatars only.
- **Where Friend Mode is promoted:**
  - **iOS:**
    - the plan recap (`plan_recap`): "Keep seeing these people? Start Friend Mode"
    - the attendee list: "Add to my crew"
    - a Home card for people with 2+ community plans and no crew
    - Profile
  - **Web:**
    - `/m/[notificationId]` and `/p/[eventGroupId]` after an RSVP, leading to `/crew/start?from=<eventGroupId>`, which lists co-attendees by name
    - `/friends` (marketing)
    - a section on `/personal`
    - links in `MarketingNav` and `MarketingFooter`

## Introducing Friend Mode: the intro popup
One popup, shown once, in three places: `/me`, the web dashboard (`/dashboard`) and the iOS app. It explains Friend Mode, gets the person to add their friends, and starts the automated planning. The three versions share the same steps and copy so the product feels like one thing.

### Steps
1. **Meet Friend Mode.** "Leaf finds a night that works for your friends and plans it. You add the people; Leaf does the rest." One line on how it works, plus what your friends will get (one text asking them to join; nothing before they say IN).
2. **Name your crew.** A text field with a suggestion ("Thursday crew", "The usual").
3. **Add people.** This step is the point of the popup:
   - **iOS:** the contact picker (`ContactPickerView`), with a **"People you've met"** row on top: co-attendees from community plans (`getFriendModeSuggestions`), names and avatars only, each with a one-tap Add.
   - **Web (/me and dashboard):** "People you've met" chips first, then name-and-phone rows (up to 14). No contact import on the web.
   - Minimum 2 people to continue (crew plus organizer is 3, so `quorum` is reachable).
4. **How often?** Every week, 2, 3, 4, 6 or 8 weeks. Default 4.
5. **Start.** "Send the invites." Confirmation: "Invites sent. Leaf starts planning your first night as soon as {quorum − 1} more people join. You'll see it here." A link to the new crew (`/crew/[id]` or the crew screen), and a nudge to add a place to the Crew Book.

Closing at any step is a first-class exit. Draft state (name and people) is kept for the session so reopening doesn't lose it.

### Kickoff
- `createFriendCrew` runs on Start and sends F1 (or a push plus accept card) to each person.
- The first cycle is `trigger: member_ask`, `startedBy` = organizer, created in `picking` **immediately**, but it doesn't poll until reachable members reach `effectiveQuorum`. The sweep checks that each hour. Until then the crew page and Home card show "Waiting on {n} more to join".
- **Reminders before day 14**, until the crew reaches quorum:
  | Day | Who | What |
  |---|---|---|
  | 0 | invitees | F1 invite |
  | 3 | invitees who haven't answered | F1b, once |
  | 3 | organizer | F17 progress, only if quorum isn't reached: "2 of 5 joined {Crew}. Waiting on 1 more before I plan the first night. Add people: {link}" |
  | 7 | organizer | F18: "Still waiting on {n} more for {Crew}. Want to add a few more people, or start with who's in? Reply START to plan with {joined count}." `START` here lowers this crew's quorum to the joined count (minimum 2) and starts the poll. |
  | 14 | organizer | F19: "Nobody new has joined {Crew}. I'll hold off until you add more people: {link}". The cycle is `cancelled` with reason `no_quorum`. Adding a person later restarts it. |
  - Joins show up in real time for organizers who use the app (push plus the crew screen). For SMS-only organizers they're batched into F17 and F18 so a 5-person crew doesn't mean 5 texts.
  - When quorum is reached, the poll itself (F2) is the "we're on" message. No separate announcement.
  - Everyone who has joined but is waiting sees "Waiting on {n} more" on the crew page and gets nothing by text until the poll.

### Where and when it shows
| Surface | Who sees it | Slot |
|---|---|---|
| **/me** (`MeClient.tsx`) | Signed-in people with **no crew** who have been to **2 or more** community plans (the "people you've met" list has something in it), or who arrived with `?friendmode=1` (from `/friends` or a CTA) | The single popup slot. It yields to a pending recap and a needs-a-host popup, as today: one popup per visit. |
| **Web dashboard** (`/dashboard`, `HomeTab.tsx`) | Calendar owners with no crew | A card on the Home tab plus the popup on the first visit after launch. For calendars with ≤15 members it offers a second path: **"Turn on Friend Mode for {Calendar}"** (see "Turning Friend Mode on for an existing calendar"). |
| **iOS** (Home) | App users with no crew, on the second app open after launch, and again only through the Home card or Profile | A sheet over Home. `fm_invite` accept sheets take priority over it. |

**Gating, server-side:** `getMeDashboard` and the iOS home payload return `friendModeIntro: {eligible, suggestions[]}`. Showing it stamps `_User.friendModeIntroSeenAt` (`markFriendModeIntroSeen`), so it never auto-opens again on any surface. It can always be reopened from the "Start a crew" links.

**Analytics:** `friend_mode_intro_view`, `friend_mode_intro_step` (step number), `friend_mode_intro_dismiss`, `friend_mode_crew_created` (with people count and how many came from "people you've met").

## Auth
- **Member link** `/crew/[token]`: an HMAC token over `{membershipId, crewId, v}` with `hmacTokenSync`. It never expires but is revoked when the member leaves (`v` is bumped). It allows voting, IN/OUT, leaving and "tell Leaf". No OTP, the same trust level as the signed series-host links.
- **Owner actions on the web** (removing members, ending Friend Mode, changing the rhythm) need a one-time phone code (`requestOTP` / `verifyOTP`), like the series-host page.
- **No member's phone number is ever returned** by any Friend Mode function. Members are identified by first name and last initial.

## On /me (`src/app/me/MeClient.tsx`, `getMeDashboard` in `dashboard-functions.js:987`)
A signed-in person's crews show up on /me like this, using existing slots where possible:

| Where | What |
|---|---|
| **Under the hero** (the slot `SeriesInviteCard` uses: "someone is waiting on your answer") | **`CrewActionCard`**, the one thing a crew needs from you now, in this order: a crew invite (Join / Not now), an open date poll (date chips to vote right there), a locked night you haven't answered (IN / OUT), or, for the owner, "Book {Venue}" with the booking link and a "Booked" button. One card, with "+1 more" if there are several. |
| **"Your plans" spine** | Locked crew nights are ordinary plans. They're tagged with the crew name instead of a calendar name, and `PlanModal` shows the crew and who's going. RSVP uses the existing `setMyRsvp`. Open polls **don't** appear in the spine, only in the action card. |
| **Hero** | If the next plan is a crew night, it's the hero like any other plan. |
| **Right rail: new "Your crews" section**, above `CalendarsRail` | One row per crew: name, member avatars, and a status line ("Voting on dates · 3 of 5 answered", "Next: Thu 10/9 at Sal's", "Last together 5 weeks ago"). Tapping a row opens `/crew/[id]` (the session-authed version of the token page). There's a "Plan something" link on each row and a "Start a crew" link at the bottom. |
| **Right rail: recaps** | Crew-night recaps already flow through `RecapRail` unchanged. |
| **Prompt box** (where "Hosting an event soon?" is) | If the person has no crew and 2 or more "people you keep seeing" suggestions: "You and Maya, Jess and 2 others keep ending up at the same things. Start a crew?", which goes to `/crew/start?suggest=1`. It takes this slot instead of the hosting prompt, one prompt at a time, as today. |
| **Left out** | Friend calendars are **not counted** in `ownsCalendars` (so no "Manage your calendars" just because you have a crew), are not listed in `CalendarsRail`, and don't add to the `calCount` meta. |
| **`TextsCard`** | Its copy ("One text a week, Sunday morning") isn't true for crew members. When the person is in a crew it says: "One text a week from Leaf, plus texts from your crews when there's a night to plan." A link goes to per-crew mute or leave. |

**Server:** `getMeDashboard` adds these fields. All of them are optional (the client already accepts missing fields "while the server side ships"):
- `crewActions[]`: `{kind: "invite" | "poll" | "rsvp" | "book", crewId, crewName, cycleId, venue, dateOptions?, myVotes?, chosenOption?, bookingUrl?}`
- `crews[]`: `{crewId, name, memberAvatars[], status, statusLine, nextPlanId?}`
- `crewSuggestion`: `{names[], count}` or null
- `plans[].crew`: `{id, name}` or null

Existing helpers must skip friend calendars: `ownsCalendars` and the `CalendarsRail` rows in the same function.

**Portal:** `/crew/[id]` for signed-in members (session auth, rendering the same component as `/crew/[token]`), linked from /me. The token route remains for SMS links. When the viewer is already signed in on /me, the token page links to it.

## Portal UI
- **`src/app/crew/[token]/`** (server component plus a client island):
  - the current cycle: venue card, date options with who picked each, vote buttons, and IN/OUT after lock
  - past nights with recap photos
  - a Crew Book preview (the top 5 places by 👍) with "Open the book" leading to `/crew/[token]/book` (see "The Crew Book")
  - members (names only)
  - a "Tell Leaf" box that writes a `CrewMessage` with `channel: web`
  - Leave
  - Invalid or revoked tokens show an "This link has expired. Text PLAN to {number}" state.
- **`src/app/crew/start/`:** name, rhythm (every 2 / 3 / 4 / 6 weeks), area, then friends (name and phone rows, up to 14), then verifying your own phone, then done. `?from=<eventGroupId>` pre-fills co-attendees (names only; the server maps them to users).
- **`src/app/friends/page.tsx`:** `MarketingPage` plus `components/marketing/content/friends.ts`, following `src/app/personal/page.tsx`.
- **CTAs:** a `FriendModeCta` component on `/m/` and `/p/` (shown when the viewer attended and there are 2 or more other attendees).
- **Dashboard:** a "Turn on Friend Mode" card in calendar settings when there are 15 members or fewer.
- **Analytics** (`components/marketing/analytics.ts`): `friend_mode_cta_view`, `friend_mode_cta_click`, `friend_mode_crew_created`, `friend_mode_invite_accepted`, `friend_mode_vote`.

## iOS
- **Planning happens in `PlanningChatView`** (see "App users: the planning chat"). Crew cycles show in the Planning Hub list with a crew badge.
- **Home:** a Friend Mode card (next to `HomePeopleSection`) showing the open cycle ("Voting on dates · 3 of 5") and opening its planning chat. When nothing is open, it shows "Plan something" and "I've got one."
- **Crew screen** (from the Home card or Profile). It isn't a chat:
  - open cycles, each opening its planning chat
  - past nights
  - members and "Add people you met"
  - the Crew Book (native list over `getCrewBook` / `addToCrewBook`)
  - "What Leaf knows" (editable `profile`)
  - "Plan something" and "I've got one"
- **Create flow:** name, friends, rhythm. No payment, no location.
- **Push:** Crew cycles use the existing `planning_message` (→ `.PlanningChat(sessionId:)`). There's one new type, `fm_invite`, which opens an accept sheet and then the crew screen.

## Jobs
Added to `.ebextensions/cron-jobs.config` through `run-if-leader.sh`. The `jobScheduler.js` entry is a backup only.
- `sweepCrewCycles`: hourly at :35. Starts, nudges, locks, retries, day-of reminders, recaps.
- `flushHeldCrewMessages`: every 15 minutes. Sends texts held for the quiet window.

All steps are idempotent: they check `state` and `transitions` before acting.

## Venue attribution (future revenue)
Each `done` cycle has `venue.placeId`, `headcount`, `chosenOption` and `booked` (true or false). A later admin report groups these by venue. That's the data the venue program is sold on: featured picks and group booking deals through the existing deals and `PlanAddonPurchase`. Nothing is charged to friends.

## Compliance
- A separate **A2P 10DLC campaign** for the Friend Mode number: conversational, group coordination, with sample messages F1, F2 and F4.
- **No text before consent** except a single invite and one reminder, and the invite names the person who added them.
- STOP and HELP are handled by Twilio. HELP replies with "Leaf Friend Mode: texts about plans with your crew. Reply STOP to opt out."

## Build order
- **Phase 0:**
  - This spec.
  - **Concierge pilot:** 10 crews run by hand from the Friend Mode number for 8 weeks to test the copy and timing. Measure the share of cycles that lock, the vote response rate, and how many crews still run after 3 cycles.
- **Phase 1 (server):**
  1. `crew-poll.js`: `createCrewDatePoll`, `recordCrewVote`, `getCrewVotes`, `convertCrewPoll`, mirroring the calendar-poll object shapes (see "What exists today"). **Built.**
  2. `friendMode` fields, membership fields, `CrewCycle`, `CrewMessage`, `isFriendCalendar` and its exclusions.
  3. The Friend Mode Twilio number, `crewChannel`, `reachCrewMember`, the reply parser and `/twilioFriendModeInbound`.
  4. `createFriendCrew`, `inviteToFriendMode`, invite and consent handling.
  5. The `crew-cycle.js` engine and jobs. Venue and date pick v1 (Places plus Gemini ranking, day weights).
- **Phase 2 (portal):**
  - `/crew/[token]`, `/crew/[token]/book` (Crew Book), `/crew/start`, `/friends`
  - the intro popup on `/me` and the dashboard Home tab, and the CTAs on `/m/` and `/p/`
  - the dashboard toggle
  - analytics
- **Phase 3 (iOS):** crew cycles in `PlanningChatView` (`sourceType: "crew"`, Leaf messages, Booked button, crew badge in the Hub), the Home card, the crew screen and native Crew Book, "Plan something" and "I've got one", the intro sheet (create flow with contacts and "people you've met"), and the `fm_invite` push.
- **Phase 4:**
  - Gemini reading of `unknown` replies (preferences, availability like "in town the 14th", suggestions)
  - `profile` learning
  - the opportunity finder (drift, birthdays, new places), within `ideaCapDays`
  - the venue program

## Open questions
- **Relaying free-text replies:** members will text Leaf things that aren't commands. Examples:
  - logistics: "running 15 late", "can we do 8 instead?", "I'm bringing Sam"
  - availability: "I'm out of town the 14th", "Tuesdays never work"
  - opinions: "not sushi again", "can we try the new wine bar"
  - chatter: "lol can't wait", "who else is coming?"

  The private channel is part of the pitch: people tell Leaf things they wouldn't say to the group. **Proposal:** v1 keeps all of these private (logged, never shown). In phase 4, Leaf reads them and acts: availability and opinions change the plan quietly, and logistics are passed on as Leaf's own summary ("Jess is running 15 min late") without quoting anyone. Nothing is quoted word for word unless the member starts the text with `ALL:`.
## Out of scope (v1)
- iMessage or RCS delivery
- Real reservation integrations
- Charging friends anything
- Free-text AI replies (phase 4)
- Android (deprecated)
