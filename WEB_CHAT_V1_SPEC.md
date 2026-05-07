# Web Chat v1 — Specification

## Goal

Ship a browser-based chat for plan attendees that:

- Lets web RSVPers participate in the same plan chat that iOS users see today, using the existing Firebase Realtime Database backend
- Captures verified email at chat-join time (Google SSO), establishing the lowest-cost notification channel for that user going forward
- Funnels users to the native iOS app at the right moments (split-the-bill, hangout suggestions, etc.) without blocking their conversational use of the chat
- Replaces SMS as the primary attendee-coordination channel, dramatically reducing per-event Twilio cost

## Non-goals (v1)

- Read receipts beyond a single per-user "lastReadAt" timestamp per chat
- Typing indicators, presence, online/offline state
- Web Push notifications (PWA + service worker work deferred — pure web fallback only)
- Android app changes (no Android codebase exists)
- Migration of chat data off Firebase to Parse (deliberately keeping Firebase for sub-150ms latency)
- Native rendering for poll, note, hangoutSuggestion, readyToSplit, weeklySuggestionCarousel, importedPlanShare, planning Hub modules — all become "Open in app" fallback cards

---

## Architecture

```
                 ┌──────────────────────────┐
                 │     Web (Next.js)        │
                 │   leaf-web-portal        │
                 │                          │
                 │  - Parse JS SDK          │  ← membership, RSVP, auth bridge
                 │  - Firebase JS SDK       │  ← messages, real-time
                 └─────────┬────────┬───────┘
                           │        │
            ┌──────────────┘        └──────────────┐
            │                                       │
            ▼                                       ▼
   ┌─────────────────┐                    ┌──────────────────────┐
   │  Parse Server   │                    │  Firebase RTDB       │
   │ leaflets-server │                    │                      │
   │                 │                    │  groups/{groupId}/   │
   │  - User         │                    │    messages/         │
   │  - GroupMember  │                    │  groups/{groupId}/   │
   │  - EventNotif   │ ─── auth bridge ─► │    reads/{userId}    │
   │  - Plan         │   (custom token)   │                      │
   │                 │                    │                      │
   │  - cloud fns    │                    └──────────────────────┘
   │  - cron jobs    │                              ▲
   │  - Mailgun      │                              │
   └────────┬────────┘                              │
            │                              ┌────────┴─────────┐
            └──────────────────────────────►│  iOS App        │
                Mailgun digest emails       │  leaf-appcode   │
                                            │  - Parse SDK    │
                                            │  - Firebase SDK │
                                            └──────────────────┘
```

---

## Data flows

### 1. RSVP → join chat → land in chat

1. User RSVPs via existing web flow (phone OTP, unchanged)
2. After RSVP success, web shows the **Join the chat picker**:
   - **Get the Leaf app** — deep link via Universal Link (opens app if installed, App Store if not)
   - **Continue with Google** — web chat path; OAuth flow → returns email + name
3. On Google SSO success:
   - Update `Parse.User`: set `email`, `emailVerifiedAt`, `googleId`
   - Propagate `email` to all of this user's `GroupMembership` records (one-time backfill on first connect)
   - Mark this `EventNotification` with `joinedChatVia: "web"`
4. Redirect to `/chat/{planId}`

### 2. Loading the chat

1. Web client calls Parse cloud function `getChatToken({ planId })`
2. Cloud function:
   - Verifies caller's session token (Parse session)
   - Verifies caller has an `EventNotification` for `planId` with `status` in `["Accepted", "Owned"]`
   - Mints a Firebase custom token scoped to read/write `groups/{eventGroupId}/messages` only
   - Returns `{ firebaseToken, eventGroupId }`
3. Web client signs into Firebase with the custom token
4. Web client subscribes to `groups/{eventGroupId}/messages` via Firebase RTDB JS SDK
5. Messages arrive in real time (50–200ms typical)

### 3. Sending a message

1. Web client writes directly to `groups/{eventGroupId}/messages.push({...})` via Firebase JS SDK
2. Firebase fans out to all subscribers (web + iOS) within ~100ms
3. No Parse roundtrip required for sending

### 4. Read state

When the user opens a chat (web or iOS):
- Update `EventNotification.lastChatReadAt = Date.now()` via Parse cloud function `markChatRead({ planId })`
- Web: fires on chat mount + on tab refocus
- iOS: fires when `PlanChatView` opens (small change to existing app)

Unread count = messages in Firebase with `timestamp > lastChatReadAt`.

### 5. Daily digest

A `node-cron` job runs once a day at **9am ET**:

```
For each User where:
  - User has at least one EventNotification with status in [Accepted, Owned]
  - User.email exists
  - User.dailyDigestDisabled !== true
  - User.lastActiveInApp < (now - 24h)   [i.e. not currently active in app]

  unread_chats = []
  For each EventNotification (chat membership):
    Query Firebase: groups/{eventGroupId}/messages
      where timestamp > membership.lastChatReadAt
      limit 20
    If any messages exist:
      unread_chats.push({
        planName, planLink, messages: [{ from, text, timestamp }, ...]
      })

  If unread_chats.length > 0:
    Mailgun.send(template: "chat_digest", to: user.email, vars: { unread_chats })
```

---

## Backend changes (leaflets-server)

### B1. ACL fix on EventNotification

**Pre-existing security gap, must fix regardless of this initiative.**

`EventNotification` has no class-level permissions. A malicious authenticated user with the Parse JS SDK can read other users' notifications.

Fix in [cloud/functions.js](cloud/functions.js) `beforeSave` for `EventNotification`:
- Set per-object ACL: read/write only for `request.object.get("to")` and `request.object.get("from")`
- Add CLPs: `find` and `get` require role `user`, no public access

### B2. Parse↔Firebase auth bridge

New cloud function `getChatToken({ planId })`:

```js
Parse.Cloud.define("getChatToken", async (request) => {
  const user = request.user;
  if (!user) throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, "Login required");

  const planQ = new Parse.Query("Plan").equalTo("objectId", request.params.planId);
  const plan = await planQ.first({ useMasterKey: true });
  if (!plan) throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, "Plan not found");

  const eventGroup = plan.get("eventGroup");
  if (!eventGroup) throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, "No chat for this plan");

  const notifQ = new Parse.Query("EventNotification")
    .equalTo("group", eventGroup)
    .equalTo("to", user)
    .containedIn("status", ["Accepted", "Owned"]);
  const notif = await notifQ.first({ useMasterKey: true });
  if (!notif) throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, "Not a chat participant");

  // Mint Firebase custom token using firebase-admin SDK
  const firebaseToken = await admin.auth().createCustomToken(user.id, {
    scope: `groups/${eventGroup.id}/messages`,
  });

  return { firebaseToken, eventGroupId: eventGroup.id };
});
```

Firebase RTDB rules must enforce that `auth.uid` matches the Parse user id and only allow read/write to the scoped path. Rules update:

```
{
  "rules": {
    "groups": {
      "$groupId": {
        "messages": {
          ".read": "auth != null && auth.token.scope == 'groups/' + $groupId + '/messages'",
          ".write": "auth != null && auth.token.scope == 'groups/' + $groupId + '/messages'"
        }
      }
    }
  }
}
```

### B3. Read state field + cloud function

**Schema:**
- Add `lastChatReadAt: Date` to `EventNotification`

**Cloud function `markChatRead({ planId })`:**
- Verify caller's `EventNotification` for that plan
- Set `lastChatReadAt = new Date()`
- Save with masterKey

### B4. Daily digest cron job

New file [cloud/jobs/chatDigest.js](cloud/jobs/chatDigest.js) (or wherever existing cron jobs live).

Runs at **9am ET daily** via existing `node-cron` setup.

Logic per pseudocode in **Data flows §5**.

Skips users who:
- Have no email
- Have `dailyDigestDisabled === true`
- Were active in the iOS app within the last 24h (cheap signal: `User.lastActiveAt`)

Batched email sends — process users in chunks of 100, with rate limiting against Mailgun.

### B5. Mailgun chat-digest template

New template `chat_digest` in Mailgun. Variables: `unread_chats[]` with `planName`, `planLink`, `messages[]`, `unreadCount`.

Subject: `You have {{total_count}} unread chat message{{plural}}`

**Visual design** modeled after transactional chat-notification emails (one card per chat, each with its own prominent CTA button):

```
                    [Leaf logo]

         You have N unread chat messages

      ──────────────────────────────────────

                  [Plan Name]
            3 new messages from Sarah, Mike

      "Sarah: Should we move to 7?"
      "Mike: I'm cool with that"
      "Sarah: Anyone else?"

      ┌────────────────────────────────┐
      │       Open chat  →             │   ← prominent button, brand color
      └────────────────────────────────┘

      ──────────────────────────────────────

                 [Other Plan Name]
              2 new messages from Alex

      "Alex: pushed it back 30 min"
      "Alex: see you there"

      ┌────────────────────────────────┐
      │       Open chat  →             │
      └────────────────────────────────┘

      ──────────────────────────────────────

      Don't want these? Unsubscribe
```

Each chat card has its own CTA button linking to `{{planLink}}`. The button is the primary affordance per chat — mirrors the pattern used by Wishi, Slack, and similar transactional chat notifications.

Plain-text fallback (sent in same email as multipart):

```
You have N unread chat messages

[Plan Name] — 3 new
Sarah: Should we move to 7?
Mike: I'm cool with that
Sarah: Anyone else?
Open chat: {{planLink}}

[Other Plan] — 2 new
Alex: pushed it back 30 min
Alex: see you there
Open chat: {{otherPlanLink}}

Don't want these? Unsubscribe: {{unsubscribeLink}}
```

Unsubscribe link routes to a cloud function that sets `User.dailyDigestDisabled = true`.

**Implementation note**: render each chat card as a fully-inlined HTML table (Mailgun template language or pre-baked HTML) so it renders consistently across Gmail, Outlook, Apple Mail. Buttons should be table-cell buttons, not `<button>` elements, for email-client compatibility.

### B6. New User fields

- `email` (already exists, ensure populated by Google SSO)
- `emailVerifiedAt: Date`
- `googleId: String` (if not already present)
- `dailyDigestDisabled: Boolean`
- `lastActiveAt: Date` (already exists if iOS sets it; verify and set on iOS app foreground if missing)

### B7. New GroupMembership fields

- `email: String` (separate from existing `inviteEmail`)
- `joinedChatVia: String` (`"app"` | `"web"`)

---

## Web frontend changes (leaf-web-portal)

### W1. Post-RSVP "Join the chat" picker

New component, rendered after successful RSVP submission.

```tsx
<JoinChatPicker plan={plan}>
  <AppDownloadButton href={universalLink(plan.id)}>
    Get the Leaf app
    <Subtitle>Push notifications, split bill, save photos</Subtitle>
  </AppDownloadButton>

  <GoogleSignInButton onClick={() => startGoogleAuth({ planId: plan.id })}>
    Continue with Google
    <Subtitle>Join the chat in your browser</Subtitle>
  </GoogleSignInButton>

  <SkipLink onClick={() => router.push(`/plan/${plan.id}`)}>
    Maybe later
  </SkipLink>
</JoinChatPicker>
```

Universal link format: `https://os.joinleaf.com/plan/{planId}` — opens app if installed (via AASA), falls back to web plan page otherwise.

### W2. Chat shell

New route: `/chat/{planId}`

Layout:
- Top: plan name, attendee count, "Open in app" link
- Middle: scrolling message list (reverse-chronological loading)
- Bottom: text input + send button + image upload button

Behavior:
- On mount: call `getChatToken`, sign into Firebase, subscribe to messages
- On unmount: unsubscribe
- On window focus: call `markChatRead`
- On every new message arrival: if window has focus, call `markChatRead` (debounced 5s)

### W3. Message renderers

**Render natively (4 types):**

1. **Default text bubble** (used for `leafMessage` and any unrecognized type)
   - Text body with URL detection (linkify https://, http://, bare-domain)
   - Image rendering: `<img src={imageUrl} />` with click-to-fullscreen
   - GIF detection: same `<img>` works for animated GIFs in browsers
   - Sender name + avatar on left (or right if from current user)
   - Timestamp on hover or below
   - Same-user consecutive-message merging (hide avatar/name for runs)

2. **`response`** — small colored badge text (green for affirmative, red for negative — match iOS `ResponseMessageView`)

3. **`locationSuggestion`** — card layout:
   - Image (`suggestedLocationImageUrl`)
   - Name (`suggestedLocationName`) and address (`suggestedLocationAddress`)
   - "Add to plan" button **only if current user is plan owner** (cloud function call)

4. **`checkIn` / `reservation`** — icon + location name (look up via `locationId`); if `text` is non-empty, render as default text bubble instead

**Fallback card (everything else):**

Generic component shows: type-specific copy + "Get the Leaf app" CTA + Universal Link to that plan in app.

| Message type | Fallback copy |
|---|---|
| `readyToSplit` | "**Split the bill in the Leaf app**" + Download button |
| `note` | "Open in app to leave a note" |
| `hangoutSuggestion` | "Vote for the next hangout in the app" |
| `poll` | "Vote on this poll in the app" |
| `weeklySuggestionCarousel` | "See this week's picks in the app" |
| `importedPlanShare` | "Watch in the app" |
| Anything else with non-empty type | "Open in the Leaf app to view" |

Fallback card shows the message's `text` field as preview text where present.

### W4. Read state

- On chat mount: call `markChatRead({ planId })`
- On tab focus (visibilitychange API): if any new messages arrived while hidden, call `markChatRead`
- No client-side unread count display in v1 (would be nice, defer)

### W5. Google SSO flow

- Add Google OAuth client (reuse dashboard credentials per the prior conversation — verify they exist)
- Sign-in scope: `openid email profile`
- On callback:
  - Send Google ID token to Parse cloud function `linkGoogleAccount({ idToken, planId })`
  - Cloud function verifies token, sets `User.email`, `googleId`, `emailVerifiedAt`, propagates `email` to existing memberships
  - Returns Parse session token for the (possibly new) authenticated user
- Web stores Parse session, redirects to `/chat/{planId}`

---

## iOS app changes (leaf-appcode)

Minimal but required for the v1 picture to work end-to-end.

### A1. Default `data.url` push handler

In [AppDelegate.swift](AppDelegate.swift) around line 173-175 (the empty `default:` case in the push notification switch):

- Read `data["url"]` from notification payload
- If present and is a valid `https://` URL, open via existing `WebBrowserViewController`

This unblocks the server from including `url` in any push payload to deep-link arbitrary web pages.

### A2. Mark chat as read

In [PlanChatView.swift](Leaflet/Plan%20Chat%20Views/PlanChatView.swift):

- On view `onAppear`: call Parse cloud function `markChatRead({ planId })`
- This prevents app users from getting digest emails about messages they've already seen in the app

### A3. Universal Links — entitlements update (if needed)

Verify `applinks:os.joinleaf.com` is in [Leaflets.entitlements](Leaflets.entitlements). Existing entitlements list `user.joinleaf.com`, `leaf-205206.appspot.com`, `leaflets.page.link`. Add `os.joinleaf.com` if it's not there.

---

## Infrastructure / DevOps

### I1. Apple App Site Association file

Host at `https://os.joinleaf.com/.well-known/apple-app-site-association` (and any other domain users might land on, e.g. `user.joinleaf.com`).

Content:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAMID.com.leaflets.bundleidentifier",
        "paths": ["/plan/*", "/chat/*", "/calendar/*"]
      }
    ]
  }
}
```

Must be served:
- With `Content-Type: application/json`
- Over HTTPS
- Without redirects
- Without `.json` extension in the URL

Replace `TEAMID` and bundle id with actual values from the iOS project.

### I2. Firebase RTDB rules update

Tighten `groups/{groupId}/messages` rules per **B2** to require `auth.token.scope` matching the group. Existing rules likely allow broader access — verify and lock down.

### I3. Mailgun template registration

Add `chat_digest` template to Mailgun account. Test with sample data.

### I4. Cron job registration

Add the daily digest job to whatever scheduler the leaflets-server uses (`node-cron`, Parse Cloud Jobs, or external cron).

---

## Acceptance criteria

A user has successfully completed the v1 chat experience when:

1. Web RSVPer can RSVP via existing flow → see Join the chat picker → tap Continue with Google → land in `/chat/{planId}` with messages loaded
2. Web user can send a text message → message appears in iOS app within 200ms (and vice versa)
3. Web user can send an image → image renders inline in both web and iOS
4. iOS-sent messages of unsupported types (poll, note, etc.) appear in web as fallback cards with appropriate copy + Download CTA
5. iOS-sent `readyToSplit` message appears in web with the "Split the bill in the Leaf app" copy
6. Web user closes tab, doesn't return → 24h later receives daily digest email at 9am ET listing unread messages, with one-click unsubscribe
7. Web user opens chat → `lastChatReadAt` is updated → no longer appears in tomorrow's digest for messages they've now seen
8. iOS user opens chat → same `markChatRead` fires → also doesn't get digest email for messages they've seen in-app
9. Tapping a Universal Link to `/plan/{planId}` from any source opens the iOS app if installed (deep link to plan view), or web plan page if not
10. Push notification with `data.url` payload, when tapped on iOS, opens the URL in the in-app browser
11. ACL fix verified: an authenticated user querying `EventNotification` without a `to: currentUser` filter returns only their own records, not other users'

---

## Implementation phasing

Recommend three PRs/milestones:

**Milestone 1: Foundation (~1 week)**
- B1 ACL fix on EventNotification (security; ship even if rest is delayed)
- B2 getChatToken cloud function + Firebase rules update
- B3 lastChatReadAt + markChatRead cloud function
- A2 iOS markChatRead on chat open
- A1 iOS default push handler for data.url
- I1 AASA file deployment
- A3 entitlements update if needed

**Milestone 2: Chat UI (~2 weeks)**
- W1 Join the chat picker
- W2 Chat shell with Firebase JS SDK
- W3 4 native renderers + fallback card
- W5 Google SSO flow + linkGoogleAccount cloud function
- B6/B7 New User and GroupMembership fields

**Milestone 3: Digest (~1 week)**
- B4 daily digest cron job
- B5 chat_digest Mailgun template
- Unsubscribe handler for digest emails

Total: **~3–4 weeks** end-to-end.

---

## Open questions to resolve during implementation

1. **`imageUrl` storage backend** — likely S3 based on conversation; verify by inspecting any existing image-upload cloud function. Affects:
   - CORS headers (must allow `os.joinleaf.com` origin)
   - Web client upload path (S3 presigned URLs vs. cloud function proxy)
   - Storage cost / lifecycle policies
2. **Google OAuth client** — does the dashboard already have one we can reuse? Needs the same `redirect_uri` pattern.
3. **iOS `Plan.eventGroup` shape** — confirm `Plan` Parse class has an `eventGroup` pointer that resolves to the `EventGroup` whose objectId is the Firebase chat key. The auth bridge depends on this.
4. **`User.lastActiveAt` field** — verify iOS app sets this on foreground. If not, add a small write in `applicationDidBecomeActive`. Without it, digest will spam app users.
5. **AASA `appID` and `paths`** — get the exact Team ID + bundle id from the Xcode project; confirm path patterns match the URLs the web actually serves.
6. **Image upload from web** — out of scope for v1 minimal? Or include? If included, add an upload endpoint.
   - Recommendation: **defer to v1.5**. v1 web users can send text only; receive images from iOS. This shrinks scope and lets us launch faster.
7. **Mailgun unsubscribe**: do we want per-template unsubscribe, or global? Probably per-feature (only unsubscribes from chat digest, not all email).

---

## Cost projection (post-launch)

For 1,000 active web-chat users at typical activity:

| Channel | Per-user-per-month | Total |
|---|---|---|
| Firebase RTDB reads/writes | ~$0.02 | $20 |
| Mailgun digest emails (~30/mo per user) | ~$0.024 | $24 |
| Parse server compute (auth bridge calls) | ~$0.01 | $10 |
| **Total** | **~$0.05** | **~$54/mo** |

Compared to today's per-event SMS-driven model (~$130/mo per active Pro calendar from earlier analysis), this is roughly two orders of magnitude cheaper for equivalent or better attendee experience.

---

## v1.5 fast-follow (next sprint after launch)

- **Wake-up email after quiet period** — if a chat has been idle 24h+ and a new message arrives, send a single per-message email immediately (modeled on the Wishi-style transactional pattern: one card, one CTA). Catches the "something happened, you should check" moment without spamming during active threads. Daily digest continues to cover steady-state activity. Implementation: add `lastChatActivityAt: Date` to `EventNotification`, fire wake-up email when a new message arrives AND the chat's previous message was >24h ago AND the recipient has unread messages, with a per-user-per-chat throttle (max one wake-up per chat per 24h).
- Web client image upload
- Native rendering for poll voting (highest-value upgrade from fallback)

## Future scope (explicitly v2+)

- Web Push notifications (PWA + service worker; iOS requires Add-to-Home-Screen install with explanatory UI)
- Per-chat digest opt-out (currently global only)
- User-timezone-aware digest send time
- Read receipts beyond "lastReadAt" (per-message read state)
- Typing indicators / presence
- Chat list / multi-chat unread badges in web UI
- Migration of chat to Parse-native (deprecate Firebase) — only if Firebase costs become problematic at much larger scale
