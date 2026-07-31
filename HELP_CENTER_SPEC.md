# Help Center v1 — Specification

## Goal

Ship a self-serve Help Center at `/help` on the web portal, built on [Fumadocs](https://www.fumadocs.dev/) (Framework Mode: manual installation into the existing Next.js app), that:

- Gives hosts, organizers, and RSVPers a searchable, browsable knowledge base for using Leaf (calendars, hosting, RSVPs, organizations, billing, notifications)
- Is authored as MDX files reviewed via normal PRs — no third-party CMS, no new backend service
- Matches the existing marketing site's visual language (white background, `zinc-900` text, Inter font, uppercase-tracking headings) rather than Fumadocs' default docs theme
- Reduces inbound "how do I…" support email/SMS volume by giving people something to search before they contact us

## Non-goals (v1)

- In-app help widget / contextual help inside the dashboard (`/dashboard/...`) — v1 is a standalone public site section only
- Per-organization or per-vertical help content (apartment, HOA, church, run club, etc.) — v1 covers the generic core product only
- Localization / i18n
- "Was this helpful?" feedback capture, analytics on article views, or a feedback pipeline
- Versioned docs (multiple product versions) — Fumadocs supports this, but there is only one version of the product
- Migrating existing static pages (`/about`, `/safety`, `/privacy-policy`, `/terms-conditions`) into Fumadocs — those stay as hand-built pages
- A `help.joinleaf.com` subdomain — v1 ships as a path (`/help`) on the existing portal (see Open Questions if this changes)

---

## Why Fumadocs

Fumadocs (`fumadocs-core` + `fumadocs-ui` + `fumadocs-mdx`) is a Next.js–native docs framework: content lives as MDX in the repo, routing is a single catch-all page backed by a generated page tree, and it ships a search route handler (Orama, no external service) out of the box. Compared to hand-rolling MDX routing or pulling in a hosted wiki SaaS, it gets us sidebar nav, breadcrumbs, TOC, and search for free while keeping content in git next to the app that renders it.

---

## ⚠️ Environment-specific risks to verify before/during implementation

This repo runs **Next.js 16.2.2**, which is newer than most current Fumadocs documentation/examples assume, per [AGENTS.md](AGENTS.md). Two things changed in Next 16 that directly affect this integration and must be re-verified against `node_modules/next/dist/docs/` and the live Fumadocs docs at implementation time, not assumed from training data:

1. **Turbopack is now the default bundler and does not support `webpack()` config or webpack plugins** (`next.config.js` `webpack()` is ignored entirely under Turbopack — [Turbopack API reference](node_modules/next/dist/docs/01-app/03-api-reference/08-turbopack.md)). `fumadocs-mdx`'s Next.js plugin needs to work through Turbopack's `rules`/loader config, not a webpack plugin. Confirm `createMDX` from `fumadocs-mdx/next` is Turbopack-compatible in the installed version before relying on it; if it isn't, this project has no `--webpack` fallback path today (`dev`/`build` scripts run bare `next dev`/`next build`) and one would need to be added.
2. **`next.config.ts` vs `next.config.mjs`**: Fumadocs MDX is ESM-only and its docs recommend `next.config.mjs` "for accurate ESM resolution." This repo already uses `next.config.ts` (TypeScript, natively ESM under Next's config loader). Try wiring Fumadocs into the existing `next.config.ts` first to avoid diverging from repo convention; only fall back to renaming to `.mjs` if MDX config resolution actually fails.

Both are flagged as spikes in Phase 0 below, not assumed to "just work."

---

## Critical existing-config gotcha: the apex-domain catch-all redirect

[`next.config.ts`](next.config.ts) currently has a catch-all redirect that sends **every path** on `joinleaf.com` / `www.joinleaf.com` to `os.joinleaf.com/personal`, except two explicitly excluded paths:

```ts
{
  source: "/((?!terms-conditions|privacy-policy).*)",
  has: [{ type: "host", value: "joinleaf.com" }],
  destination: "https://www.os.joinleaf.com/personal",
  permanent: true,
},
```

As written, `/help` (and every sub-path under it) would be silently 308-redirected away on the marketing domain. **This must be updated to also exclude `help` in both host-scoped redirect blocks**, e.g.:

```ts
source: "/((?!terms-conditions|privacy-policy|help).*)",
```

This is a required part of Phase 0, not an afterthought — without it the feature is unreachable from `joinleaf.com`/`www.joinleaf.com` even though it works fine on `os.joinleaf.com`.

---

## Package installation

```bash
npm i fumadocs-mdx fumadocs-core fumadocs-ui @types/mdx
```

No additional search service, database, or CMS dependency.

---

## Architecture

```
content/help/                     ← MDX source of truth, PR-reviewed like code
  index.mdx
  getting-started/
    meta.json                     ← category order/labels
    creating-a-calendar.mdx
    inviting-people.mdx
  hosting/
    meta.json
    creating-a-plan.mdx
    managing-rsvps.mdx
    canceling-a-plan.mdx
  organizations/
    meta.json
    what-is-an-organization.mdx
    adding-members.mdx
    roles-and-permissions.mdx
  billing/
    meta.json
    subscriptions.mdx
    payment-methods.mdx
  account/
    meta.json
    notifications.mdx
    deleting-your-account.mdx
  faq.mdx

src/
  lib/
    help-source.ts                ← defineDocs/loader — Fumadocs content source
    help-layout.shared.tsx        ← shared nav options (title, links back to joinleaf.com)
  components/
    help-mdx.tsx                  ← MDX component overrides (brand-matched typography)
  app/
    help/
      layout.tsx                  ← DocsLayout wrapper; imports Fumadocs UI CSS *here only*
      page.tsx                    ← /help landing/index redirect or overview
      [[...slug]]/
        page.tsx                  ← catch-all MDX page renderer
    api/
      help-search/
        route.ts                  ← Orama search route (fumadocs-core)

next.config.ts                    ← wrap with createMDX(); update redirect regex (see above)
```

### Route surface

- `/help` — landing page (featured categories, search box)
- `/help/[category]/[article]` — individual articles, driven by `content/help/**`
- `/help/api/help-search` (or `/api/help-search`, TBD in Phase 0) — search endpoint, not user-facing

### Content source config

Following current Fumadocs "Framework Mode" conventions (verify exact API surface against `https://www.fumadocs.dev/docs/manual-installation/next` at implementation time — this library iterates quickly):

```ts
// src/lib/help-source.ts
import { defineDocs } from "fumadocs-mdx/config"; // or fumadocs-mdx/macro, per current docs
import { loader } from "fumadocs-core/source";

const docs = defineDocs({ dir: "content/help" });

export const helpSource = loader({
  baseUrl: "/help",
  source: docs.toFumadocsSource(),
});
```

### `next.config.ts`

```ts
import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

const nextConfig: NextConfig = {
  // ...existing headers/redirects (with the /help exclusion above)...
};

export default withMDX(nextConfig);
```

---

## Styling — scope Fumadocs CSS to `/help` only

Fumadocs UI ships its own CSS (`fumadocs-ui/css/neutral.css`, `fumadocs-ui/css/preset.css`) with its own color tokens and a `prose`-like typography reset. The rest of this app hand-tunes Tailwind v4 utility classes directly (see [`globals.css`](src/app/globals.css) and every static page) with no shared `prose`/typography plugin today.

**Decision: do not add the Fumadocs CSS imports to the global `globals.css`.** Import them only inside `src/app/help/layout.tsx` (or a CSS file scoped to that route segment) so they cannot bleed into `/dashboard`, `/about`, or any other route. Then layer a small brand override (CSS variables Fumadocs UI reads for its theme — background, foreground, accent) so the help section reads as "Leaf" rather than the default Fumadocs neutral theme:

- Background: white
- Foreground: `zinc-900`
- Font: existing `--font-geist-sans` (Inter) variable already defined in `globals.css`
- Accent: pick one existing brand accent color used elsewhere in the app (audit `about`/`organizations` pages for the canonical one — several pages currently use plain `zinc-900`/white with no color accent, so this may just stay monochrome)

This needs a visual check in the browser once wired up — Fumadocs' default sidebar/TOC chrome is opinionated and will need real review against the rest of the site, not just a config-level color swap.

---

## Information architecture (v1 seed content)

Categories chosen to match the product surfaces visible in `src/app/` (dashboard, organizations, calendars, plans/RSVPs, billing via Stripe) rather than the vertical landing pages (`apartment`, `moms-club`, `run-club`, etc. — those are marketing pages for specific org types, not help topics, and are out of scope per Non-goals):

1. **Getting Started** — creating a calendar, inviting your first people, understanding the dashboard
2. **Hosting** — creating a plan, editing/canceling a plan, managing RSVPs, the plan chat
3. **Organizations** — what an organization is, adding/removing members, roles & permissions, virtual hosts
4. **Calendars & RSVPs** — how RSVP works, calendar sync, notifications for attendees
5. **Billing** — subscriptions, payment methods, canceling a subscription
6. **Account** — notification settings, phone/email verification, deleting your account
7. **FAQ** — flat catch-all page for short Q&A that doesn't warrant its own article

Seed target: 12–18 short articles covering the above, written from what currently exists in the product (not speculative features).

---

## Search

Use Fumadocs' built-in search (`fumadocs-core/search`, Orama-based) via a route handler at `app/help/api/search/route.ts` (or top-level `app/api/help-search/route.ts` to avoid namespacing under the catch-all — decide in Phase 0 based on how Fumadocs' `[[...slug]]` route interacts with sibling routes). No external search service (Algolia, etc.) — content volume is small enough that Orama's in-memory/static index is sufficient.

---

## SEO / metadata

- Each article's `generateMetadata` pulls `title`/`description` from MDX frontmatter (Fumadocs' loader exposes this)
- `/help` and its articles should be crawlable — confirm there's no `robots` blocking (repo currently has no `robots.ts`/`sitemap.ts`, so nothing to reconcile there, but double check before shipping)
- No OG image generation in v1 (non-goal)

## Access model

Public, unauthenticated, same as `/about`, `/safety`, `/privacy-policy`. No relationship to the Parse-based auth used in `/dashboard`. Articles may link into authenticated app routes (e.g. "go to your [notification settings](/dashboard/settings)") but the help section itself never checks auth state.

---

## Surfacing the link (mechanical follow-up, small PR)

There's no shared `<Footer>`/`<Header>` component in this codebase — every static page (`about`, `safety`, `privacy-policy`, `terms-conditions`) hand-builds its own footer JSX with a "Legal"/"Platform" link list (see [`about/page.tsx`](src/app/about/page.tsx)). Adding a "Help" link means touching each of these footers individually. Scope this as a fast-follow after the core section ships, not part of Phase 0/1.

---

## Content authoring workflow

- MDX files in `content/help/**`, one article per file, `meta.json` per folder controlling sidebar order/labels (standard Fumadocs convention)
- Frontmatter schema: `title` (required), `description` (required, used for `<meta>` and search result snippets)
- Reviewed via normal GitHub PRs — no CMS, no non-technical editor flow in v1
- No component library beyond Fumadocs' MDX defaults + whatever brand overrides land in `help-mdx.tsx`

---

## Rollout plan

**Phase 0 — Infra spike**
- Install packages, wire `createMDX` into `next.config.ts`, confirm Turbopack dev/build both work (see risks above)
- Fix the apex-domain redirect exclusion
- Ship `/help` with one placeholder article behind the real layout/theme, confirm styling is scoped correctly (no bleed into `/dashboard` or other routes)

**Phase 1 — Content**
- Write the 12–18 seed articles across the 6 categories above
- Wire up search

**Phase 2 — Polish & discoverability**
- Brand-match the theme fully (sidebar, TOC, code blocks if any)
- Add "Help" links to existing static-page footers
- Visual QA pass across desktop/mobile

**Phase 3 — Future (explicitly out of scope now)**
- In-app contextual help / widget in `/dashboard`
- "Was this helpful?" feedback + analytics
- Vertical-specific content (per organization type)
- Possible `help.joinleaf.com` subdomain split

---

## Open questions

1. Path (`/help`) vs subdomain (`help.joinleaf.com`) — path is simpler given the existing apex-domain redirect setup and is what this spec assumes; revisit if SEO or brand wants a subdomain later.
2. Where does the search route live relative to the `[[...slug]]` catch-all so it isn't shadowed — needs a concrete answer during Phase 0 implementation, not guessed here.
3. Should `/help` be excluded from the `X-Frame-Options: SAMEORIGIN` / CSP header rules currently applied per-path in `next.config.ts`? Default assumption: no change needed, same as any other non-`/embed` page.
4. Who owns ongoing content accuracy as the product changes (no automated staleness detection in v1)?
