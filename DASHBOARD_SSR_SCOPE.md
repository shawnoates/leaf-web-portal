# Scope: server-rendering the owner dashboard

Status: **proposal, not started.** Written 2026-08-19 as the follow-on to the
flicker fixes already landed (skeleton chrome, recharts/joyride code-splitting,
analytics refetch dedup).

## What problem is left

The landed fixes removed the paint-1 → paint-2 *geometry* jump and cut
first-paint JS from 614KB → 463KB gzipped. What they did not remove is the
**cache-then-network content swap**:

| # | On screen | Trigger |
|---|---|---|
| 1 | Skeleton chrome | SSR HTML |
| 2 | Dashboard, **cached** data | `page.tsx` cache-hydrate effect (localStorage) |
| 3 | Dashboard, **fresh** data | `setDashboard(result)` after `getOrgDashboard` |

Paint 2 → 3 is the residual flicker: counts, plan lists and badges change a
beat after load whenever the cache is stale. It cannot be fixed on the client,
because on the client there is no way to have fresh data at first paint.

## The blocker: there is no session on the server

`getOrgDashboard` is not public. `cloud/functions.js:27626`:

```js
Parse.Cloud.define("getOrgDashboard", async (request) => {
  const user = request.user;
  if (!user) throw new Parse.Error(401, "Authentication required.");
```

The session that satisfies `request.user` currently lives **only in
localStorage**, written by the Parse JS SDK when `Parse.User.become()` runs in
the browser. A server component cannot read it. So:

> **Nothing about this route can be server-rendered with real data until the
> session token is also in a cookie.** That is the whole project; the component
> refactor is the easy half.

Sessions are created in 6 places and destroyed in 7:

| Created | Destroyed |
|---|---|
| `components/GoogleSignInButton.tsx:77` | `app/dashboard/[calendarId]/page.tsx:1198` |
| `components/JoinChatPicker.tsx:81` | `app/dashboard/page.tsx:108` |
| `app/org/[shareId]/page.tsx:698` | `app/org/[shareId]/page.tsx:2165` |
| `app/me/MeClient.tsx:305`, `:1279` | `app/organizations/setup/page.tsx:200` |
| `app/m/[notificationId]/MemoryClient.tsx:861` | `app/account/delete/page.tsx:115` |
| | `components/AppHeader.tsx:49`, `GoogleSignInButton.tsx:119` |

Every one must write/clear the cookie or sessions silently desync between tabs
and the server. 22 files read `Parse.User.current()` and are downstream of this.

## Why the naive version makes things *worse*

`getOrgDashboard` is ~930 lines (`functions.js:27626-28559`) with ~50 awaited
queries. If `page.tsx` becomes an async server component that awaits it before
returning, that latency moves into TTFB — the browser sees **nothing** (not even
the skeleton) until the whole thing resolves. Returning owners, who today get
cached data on paint 2 almost immediately, would regress badly.

So the design has to be: **static shell streams immediately, data streams in
behind a Suspense boundary.** Per `node_modules/next/dist/docs/01-app/02-guides/streaming.md`,
each `<Suspense>` boundary is an independent streaming point and the shell is
flushed before any async work resolves.

## Proposed design

```
app/dashboard/[calendarId]/
  layout.tsx        (server) — reads session cookie, 401 → redirect
  loading.tsx       (server) — DashboardSkeleton, already written
  page.tsx          (server) — renders shell + <Suspense><DashboardData/></Suspense>
  DashboardData.tsx (server, async) — awaits getOrgDashboard w/ sessionToken
  DashboardClient.tsx ("use client") — everything interactive, gets data as props
```

Server-side Parse calls must pass the token **per call**, never via
`Parse.User.become()`:

```ts
// lib/parse.ts is a module singleton — become() would leak the session
// across concurrent requests. Verified supported: parse/lib/node/Cloud.js:85
await Parse.Cloud.run("getOrgDashboard", { calendarId }, { sessionToken })
```

The client component keeps all 86 `useState`, 22 `useEffect` and 25
`Parse.Cloud.run` mutation handlers. It receives the first payload as a prop
instead of fetching it, and the localStorage cache can be deleted — the server
payload is always fresh, so there is nothing to revalidate against.

## Phases

**Phase 0 — spike (0.5d, do this first).** Confirm AWS Amplify actually streams
Next SSR responses rather than buffering them. `amplify.yml` is a stock config;
if Amplify buffers, the shell will not flush early and the entire design
collapses back into "slow TTFB". **If this fails, stop — do not proceed.**
Deploy a throwaway route with a `<Suspense>` around a 3s sleep and watch the
response with `curl -N`.

**Phase 1 — session cookie (2-3d).** The real work.
- Set an HttpOnly, Secure, SameSite=Lax cookie alongside every `User.become()`.
  Needs a route handler (`app/api/session/route.ts`) since HttpOnly can't be set
  from JS.
- Clear it on all 7 logout paths.
- Server helper `lib/session.ts` → `getSessionToken()` via `cookies()`.
- Handle expiry: Parse throws 209 on an invalid token; catch server-side, clear
  the cookie, redirect to sign-in.
- Ships independently and is useful on its own (`/me`, `/inbox`, `/calendars`
  all benefit later).

**Phase 2 — split the page (2-3d).** Mechanical but large: 3,669 lines, one
component. `"use client"` moves from `page.tsx` to a new `DashboardClient.tsx`;
`page.tsx` becomes the server shell. The `?tab=` / `?cal=` / `?openPoll=` /
`?virtualHostAttached=` param handling (7 ref-guarded effects) stays client-side
— it is all post-hydration behavior.

**Phase 3 — delete the cache (0.5d).** Remove the localStorage hydrate and
`dashboardCacheKey` writes. This is what actually kills paint 3.

**Phase 4 — measure (0.5d).** Same method used on the last round: `curl` the
deployed route, diff SSR HTML and gzipped first-paint JS.

**Total: ~6-8 working days**, gated on Phase 0.

## Risks

- **Amplify streaming (high).** Phase 0 exists to kill this early.
- **Session cookie is a security change (high).** HttpOnly + Secure +
  SameSite=Lax, scoped to the app host. Getting this wrong is worse than a
  flicker. Worth a security review pass on the diff.
- **Concurrency (medium).** `lib/parse.ts` is a shared singleton. Any
  server-side `become()`/`logOut()` leaks across requests. Per-call
  `{ sessionToken }` only.
- **Two auth sources during rollout (medium).** localStorage and cookie coexist
  until every entry point writes both. Expect "logged in on the client, logged
  out on the server" bugs. Mitigate by having the server treat a missing cookie
  as "render the shell, let the client fetch" — i.e. exactly today's behavior,
  so it degrades instead of breaking.
- **`getOrgDashboard` latency becomes visible (low).** Today it hides behind a
  cached paint. Streaming makes it a visible gap between shell and content —
  better than a spinner, but it will make the ~1s cost obvious. Worth profiling
  the 50 queries separately.

## Not in scope

`/org/[shareId]` (5,754 lines, same architecture, public so no cookie needed —
easier, and arguably higher traffic; separate effort). The other 20 client
pages. Any change to `getOrgDashboard` itself.
