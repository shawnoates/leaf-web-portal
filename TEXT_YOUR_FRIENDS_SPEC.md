# Text your friends: invite from your own iMessage

> Built 2026-11-03/04. iOS app (in-app dashboard + native queue), web
> dashboard, Parse server. This doc describes what shipped; open items are at
> the end.

## Why

Hosts want to send a calendar or a plan to a lot of friends at once, from
their **own** iMessage, not from a Leaf number. No API sends from someone
else's Apple ID, and Leaf's Twilio line is the wrong sender for a first
contact:
- cold texts from a business number need consent;
- carriers filter them;
- `client-send-guard.js` caps them at 20 numbers an hour and 60 a day.

Partiful works the same way: hosts share the link themselves, and Partiful's
own number only texts guests who have RSVP'd.

So the pattern is:

1. **First touch:** the host's own phone, one friend at a time, with one tap
   per friend.
2. **Every touch after that:** Leaf, and only within what the friend agreed
   to when they followed or RSVP'd (see Follower texts below).

## What can be sent

One queue sends either kind of invite. What's being shared decides the link,
the message and what counts as success.

| Round for | Link | Success | Default message |
|---|---|---|---|
| A calendar | `/org/<shareId>?src=i-<token>` | Follows | Hey {first}! I'm putting {calendar} on one calendar. Follow it so you see every night: {link} |
| One plan | `/p/<eventGroupId>?src=i-<token>` | RSVPs (Accepted) | Hey {first}! {title} on {Fri, Nov 7}. Come with? RSVP here: {link} |

- `{first}` is the contact's first name; with no name the greeting is just
  "Hey!". `{link}` is the friend's own link, appended if the host's edit
  dropped it.
- The host can edit the message once before starting; that text is used for
  every friend.
- The plan's day is in the plan's timezone, else the calendar's, else Eastern.
- A plan round only works for plans the calendar hosts (not cross-promoted
  ones), that are upcoming and not cancelled.

## Where it starts

All entry points are in the dashboard, which the app shows in its in-app web
view. A page sees the app's user agent (`LeafApp/ios … LeafText/1`) and
links to `leaf://text-friends/<calendarId>`, which opens the native queue.

- **Profile → Calendars** opens a calendar in the app (`CalendarWebScreen`):
  the dashboard for one you own or co-host (a signed `?u=&t=` link, so it's
  signed in), the public page for one you follow. The Home carousel's
  long-press **Open calendar** does the same.
- **"Get your first 10 followers" sheet:** the **Text friends** tile.
- **Home → "Friends you texted" card:** **Text friends** (a new round) and
  **Text again · n** (`?to=<phone>|<name>` per friend who hasn't followed;
  skips the picker and the re-text question).
- **Calendars tab → each plan card:** a text icon next to Copy link, for
  plans this calendar hosts (`?plan=<eventGroupId>`).

Off the app, a web page can't open Messages one friend at a time, so the
dashboard shows the record only ("Text more friends from the Leaf app") and
the sheet's tile falls back to a single `sms:` link.

## The queue (iOS, `TextFriendsView.swift`)

1. **Pick:** `CNContactPickerViewController`, multi-select, limited to
   contacts with a phone (no Contacts permission needed). Prefers a mobile or
   iPhone number.
2. **Message:** the server returns the template and one invite per friend.
   People already in (following the calendar, or going to / requested the
   plan) are left out and named.
3. **Queue:** `MFMessageComposeViewController` with **exactly one**
   recipient. After a Sent, the next composer opens 0.5 s later. Cancelled
   counts as skipped. Each result goes to `markTextInvite`.
4. **Resume:** leaving saves the round (UserDefaults, per calendar and per
   plan); coming back offers **Pick up where you left off**.
5. **Re-text check:** friends texted in the last 7 days for the same calendar
   (or the same plan) are flagged, and the host confirms before texting them
   again. Text again skips this on purpose.

Without Messages (iPad, simulator) the composer falls back to the share
sheet.

**Never put more than one recipient in a composer**: several numbers make a
group chat. (`FMMessageComposer.present` in Friend Mode passes an array; the
queue does not use it.)

## Tracking

Class **`TextInvite`** (ACL: master key only):

| Field | Notes |
|---|---|
| `token` | 8 chars, in `?src=i-<token>` |
| `host` | User who texted |
| `calendar` | Always set |
| `plan` | EventGroup, only on a plan round |
| `phone` | E.164 |
| `name` | From the contact |
| `status` | `queued` → `sent` / `skipped` / `failed` → `opened` → `joined` |
| `sentAt`, `openedAt`, `joinedAt` | |
| `follower` | The user who followed or RSVP'd |

Cloud functions (`cloud/text-invites.js`):
- `createTextInvites({ calendarId, contacts[], planId? })`: managers only, up
  to 50 per call. Returns `{calendarName, planTitle, template, invites[],
  alreadyFollowing[]}`.
- `markTextInvite({ token, status })`: the host's composer result. Never
  downgrades opened or joined.
- `textInviteOpened({ token })`: no auth.
- `getTextInvites({ calendarId, planId? })`: one row per friend, best news
  first (joined, opened, sent), plus counts. Without `planId` it's calendar
  rounds only.

How each status is reached:
- **opened:** the calendar page calls `textInviteOpened` for an `i-` source.
  A plan link usually forwards to `/org/<shareId>?plan=<id>&src=i-<token>`;
  the plan page's `ArrivalTracker` beacons it first, so it counts even
  through the redirect.
- **joined (calendar):** `followCalendarViaWeb` stamps
  `GroupMembership.followSource` and calls `markTextInviteJoined`. Plan rows
  are ignored there.
- **joined (plan):** the RSVP sends `source` (kept per plan for the visit by
  `captureTextInvite` / `textInviteSource`), and `rsvpToPlanViaWeb` calls
  `markTextInviteRsvped` when the seat is Accepted. A request awaiting
  approval doesn't count yet.

**Results:** the dashboard Home card **"Friends you texted"** shows calendar
rounds: "{n} texted · {n} opened · {n} following", rows with Following /
Opened / Texted {date}, five by default.

## Follower texts (what Leaf sends after the first touch)

- **Push:** every follower with the app gets a push for each new plan
  (`notifyFollowersOfNewPlan`). Tapping it opens the native plan screen,
  including a recurring plan's later dates.
- **Weekly roundup:** the default for text followers, at most 2 texts a week.
- **Per-plan texts (Pro):** Settings → Notifications → **Text each new
  plan**. Off by default; on a Free calendar the switch opens the upgrade.
  It's stored on the root org (`orgFollowerPlanTexts`) and only counts while
  the tier is paid (`cloud/follower-plan-texts.js`).
- **Consent:** per-plan texts go only to followers who agreed to them
  (`GroupMembership.planTextsConsentAt`):
  - a text follow made while the follow screen said "a text for each new
    plan" (`followCalendarViaWeb`'s `planTextsConsent`); or
  - an existing follower who picks **Each plan** for that calendar on /me
    (`setPlanTextsOptIn`).
  Everyone else stays on the weekly roundup. The owner's Settings note says
  so.
- **Follow screen wording:** "Up to 2 msgs/wk" normally; "a text for each
  new plan on this calendar, plus a weekly roundup. Msg frequency varies"
  when per-plan texts are on. Both carry rates, HELP and STOP.

## Guardrails

- **No server sending.** The invites never touch Twilio.
- **One recipient per message**, every time.
- **50 friends per round.** Keeps a burst from getting the host's iMessage
  flagged as spam.
- **7-day re-text check** per calendar or per plan.

## Open

1. **Plan round results:** `getTextInvites({planId})` exists, but no screen
   shows a plan's texted friends yet (the calendar card only shows calendar
   rounds).
2. **Native entry points:** the native calendar and plan screens don't have a
   Text friends button; everything starts from the dashboard.
3. **Share rewards:** check that `i-` follow sources count in
   `share-rewards.js`.
4. **Analytics:** none of the planned events (`text_invite_started`,
   `_result`, `_finished`, `_resumed`, `_opened`, `_joined`) are sent yet.
5. **Android:** out of scope while iOS is the only mobile client.
