# Text your friends: invite from your own iMessage

> Draft 2026-11-03. Not built. Surfaces: iOS (primary), web dashboard.

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
2. **Every touch after that:** Leaf. The friend followed or RSVP'd, which is
   their opt-in, and the existing follower fan-out takes over
   (`notifyFollowersOfNewPlan`: push, SMS when the plan's flag is on, and the
   weekly digest).

## What can be sent

The same queue sends either kind of invite. What's being shared decides the
link and the message.

| Started from | Link | Friend does | Default message |
|---|---|---|---|
| A calendar | `/org/<shareId>?src=i-<token>` | Follows | Hey {first}! I'm putting {my birthday plans} on one calendar. Follow it so you see every night 🎂 {link} |
| A plan | `/p/<eventGroupId>?src=i-<token>` | RSVPs | Hey {first}! {title}, {Sat Nov 8 at 8}. You in? {link} |

- `{first}` is the contact's first name. If there's no name, drop the
  greeting to just "Hey!".
- The host can edit the message once before starting. That text is used for
  every friend, with `{first}` filled in for each. It isn't edited per send.
- **The calendar invite is the one to push.** It's one ask per friend, and
  every later night reaches them without the host. The plan invite is for
  people who don't follow yet, or a short personal list for one night.
- The calendar link preview (OG image) should show the next 2–3 upcoming
  dates, so it doesn't look like an empty calendar.

## Flow (iOS)

**Entry points**
- Calendar screen: **Text your friends**, next to Share.
- Plan screen: **Text your friends**, next to Share.
- Right after creating a calendar or a plan, as the first share option.

**1. Pick**
- Reuse the existing contact picker, multi-select.
- Show Leaf contacts who already follow this calendar (or RSVP'd to this
  plan) as "Already in" and don't allow selecting them.
- Show people already texted for this calendar or plan as "Texted {Nov 2}".
  They can be selected again if the host wants.

**2. Message**
- One screen shows the default message with the link already in it, and an
  Edit option.
- Button: **Start texting · {n}**.

**3. Queue**
- Opens `MFMessageComposeViewController` with **one** recipient and the body
  filled in for that friend.
- After each composer closes, a slim bar shows: **{k} of {n} sent** ·
  **Next: {name}** · Skip · Stop.
  - Sent → mark sent, open the next composer right away.
  - Cancelled → treat as Skip, show the bar, don't auto-advance.
  - Failed → mark failed, show the bar.
- Stop or backgrounding the app saves the queue. Coming back offers
  **Pick up where you left off ({n} left)**.
- Done screen: "{k} texted." Below it, a live list of who has tapped the
  link and who has followed or RSVP'd, filled in as they act.

**Never put more than one recipient in a composer.** Several numbers in one
composer creates a group chat. The existing `FMMessageComposer.present` in
`FriendModeHubView.swift` passes an array of numbers. The queue must pass
exactly one number per composer.

If `MFMessageComposeViewController.canSendText()` is false (iPad without
Messages, simulator), fall back to the share sheet with the message and say
"Send this from your phone to text friends one by one."

## Flow (web)

On the calendar dashboard and the plan page, **Text your friends** opens a
sheet:
- Paste or type names and numbers, or pick from the host's Leaf contacts.
- Each row is the friend's name with a **Text** button
  (`sms:<number>&body=<message>`, built per row, never with several
  addresses). The row turns ✓ once it's tapped.
- On a Mac this opens Messages, which is the host's iMessage. On a phone it
  opens the phone's Messages app.

The web can't tell whether a message was actually sent. A tap counts as
"opened composer", and is shown as ✓ texted.

## Tracking

New class **`TextInvite`**:

| Field | Notes |
|---|---|
| `token` | Short random string (8 chars), what goes in `?src=i-<token>` |
| `host` | User |
| `calendar` / `eventGroup` | Whichever was shared; the other is null |
| `phone` | E.164, normalized the same way as `followCalendarViaWeb` |
| `name` | Name from the contact |
| `status` | `queued` → `sent` / `skipped` / `failed` → `opened` → `joined` |
| `sentAt`, `openedAt`, `joinedAt` | |

- Cloud functions:
  - `createTextInvites({ calendarId | eventGroupId, contacts[] })` returns a
    token per contact.
  - `markTextInvite({ token, status })` records each composer result.
- The token is unique per friend, so `opened` and `joined` can be credited
  to that friend.
- `?src=` is already captured by `captureFollowSource` and stamped as
  `GroupMembership.followSource` in `followCalendarViaWeb`. The `i-` prefix
  passes the `VALID` regex, so calendar follows are attributed with no new
  plumbing. A `followSource` starting with `i-` sets the matching
  `TextInvite` to `joined`.
- `/p/<id>` needs the same `?src=` capture added for RSVPs
  (`rsvpToPlanViaWeb`).
- The page visit sets `opened`. Count it once, through the same arrival
  tracking `captureFollowSource` already does.

**Share rewards.** `share-rewards.js` already rewards first follows through
a link. Check that `i-` sources count toward the host's points and aren't
filtered out.

## Guardrails

- **No server sending.** This feature never touches Twilio. Every message
  goes out through the host's own Messages app.
- **One recipient per message**, every time (see Flow above).
- **A soft cap of 50 friends per queue.** It isn't a technical limit; it
  keeps hosts from sending so many messages in a burst that Apple's spam
  reporting flags their iMessage.
- **Re-texting the same friend for the same calendar** within 7 days shows
  "You texted {name} on {date}. Text again?"
- **Joining doesn't add new texts.** A friend who follows the calendar gets
  the existing follower rules: SMS only when the plan's flag is on, a 9 AM–9 PM
  send window, and a ceiling of 2 SMS per person per week.

## Open questions

1. **Consent:** does the follow step (`ContactStep` / FollowModal) state that
   Leaf will text about new nights, with STOP wording? If not, add it before
   relying on SMS to people who joined through a text invite. Friend Mode
   has its record at `/friends/sms-consent`, and calendar follows need the
   same.
2. **Personal calendars:** should a birthday or personal calendar default its
   per-plan SMS flag to **on**, since its followers are friends who asked to
   hear about it?
3. **Android:** out of scope while iOS is the only mobile client.

## Events

- `text_invite_started` {kind: calendar|plan, n}
- `text_invite_result` {result: sent|skipped|failed}
- `text_invite_finished` {sent, skipped}
- `text_invite_resumed` {left}
- `text_invite_opened` {kind}, `text_invite_joined` {kind}
