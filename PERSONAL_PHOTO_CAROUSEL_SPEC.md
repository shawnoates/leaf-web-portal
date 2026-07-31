# Personal Page Photo Row — Specification

## Goal

Add a row of real-life-looking photos — people having fun together in a group — to `/personal` (`os.joinleaf.com/personal`), immediately after the hero. This is a social-proof/emotional-hook section: right now the hero sells the AI-prompt generator, and the very next thing visitors see ("Who it's for") is a text block. A row of warm, candid-feeling group photos closes that gap before the copy does the explaining, in the visual style of yorby.ai's reference section (see below).

## Reference pattern (yorby.ai)

Confirmed via screenshot the user shared — this is **not** a scrolling carousel, and Yorby's own photo content isn't "groups having fun" (theirs is UGC-style testimonial screenshots — screen recordings and talking-head selfies, used for a different kind of social proof). What we're borrowing is the **visual treatment**, not their content:

- A single static row of **portrait-oriented photo cards** (~9:16, like phone-screenshot proportions), sized so all ~8 fit in one row within the page's max-width container on desktop — no scroll needed at that width.
- Each card is **rotated at a small alternating angle** (e.g. -6°, +4°, -3°, +5°, -4°, +3°, -5°, +6°...) with a subtle drop shadow, giving a "fanned deck of photos" look rather than a clean grid.
- Cards sit close together with slight overlap/tight gaps, not evenly spaced.
- Directly above the row (in Yorby's case) is a one-line attributed pull quote ("Cole Baker, Marketing Agency Owner" / *"It's the one AI tool..."*) — see [Open questions](#open-questions) on whether Leaf wants an equivalent line, since our Non-goals currently rule out per-photo captions but a single quote above the whole row is a different, smaller thing.
- No arrows, no dots, no autoplay — confirmed static, matching this spec's existing non-goals.

## Non-goals (v1)

- No swipe/carousel library dependency (Embla, Swiper, etc.) — see [Component approach](#component-approach)
- No autoplay/ken-burns animation — the row is static on desktop, plain scroll (no snap-driven auto-advance) on mobile
- No CMS or admin UI for managing photos — images are static files in the repo, swapped via PR like every other marketing image
- No captions, names, or attributed testimonial text under the photos — this is pure atmosphere/social-proof, not a testimonials section (that would be a separate, future spec)
- No lightbox/click-to-expand
- No per-device (mobile vs. desktop) different image sets

## Photo sourcing

Photos are AI-generated (already in hand, per the user) rather than licensed stock or real customer photos. This affects the spec in one way worth flagging explicitly:

- **Must look like real, in-the-moment photography**, not obviously staged/glossy stock-photo aesthetic or artifacted AI output (extra fingers, warped faces, nonsense text in the background, uncanny symmetry). Whoever generates/curates the final set should sanity-check every image at full size before it ships — a single "off" face undermines the authenticity this section exists to create.
- Recommend a mix of settings/activities consistent with what Leaf actually does (dinners, coffee walks, group hangouts, outdoor group activities) rather than generic "friends laughing at a laptop" stock tropes — ties the visual to the product instead of reading as filler.
- Since there's no real customer likeness involved, no model-release/consent concerns — but keep the generated people looking plausibly diverse in age/background to match a broad "your friend group" positioning, not a single demographic.

## Placement

Inserted directly after `<PersonalHero />` and before the existing "Who it's for" section, in [`src/app/personal/page.tsx`](src/app/personal/page.tsx:163):

```tsx
<PersonalHero isLoggedIn={isLoggedIn} />

{/* Photo row — new section */}
<PhotoGrid />

{/* Who it's for */}
<section className="py-24">
  ...
```

## Component approach

No carousel/slider library needed — this is a static row, not a scroll interaction, on desktop. But the row of ~8 portrait cards at full size won't fit in a mobile viewport, so mobile needs *some* overflow handling. The codebase's de-facto horizontal-scroll convention (used in [`src/components/DealsStrip.tsx`](src/components/DealsStrip.tsx) and elsewhere) — `overflow-x-auto no-scrollbar snap-x snap-mandatory` backed by the `.no-scrollbar` class already in [`globals.css`](src/app/globals.css:8) — is the natural fallback for narrow widths: static/untruncated on desktop, scrollable on mobile, same underlying markup either way.

New file: `src/app/personal/PhotoGrid.tsx` (co-located with `PersonalHero.tsx`, same pattern):

```tsx
const PHOTOS = [
  { src: "/photo-row/group-dinner-1.jpg", alt: "Friends laughing at a dinner table", rotate: "-rotate-6" },
  { src: "/photo-row/coffee-walk-1.jpg", alt: "A small group on a coffee walk", rotate: "rotate-4" },
  { src: "/photo-row/game-night-1.jpg", alt: "Friends around a table playing a game", rotate: "-rotate-3" },
  { src: "/photo-row/park-hangout-1.jpg", alt: "A group relaxing together in a park", rotate: "rotate-5" },
  { src: "/photo-row/rooftop-1.jpg", alt: "Friends gathered on a rooftop at sunset", rotate: "-rotate-4" },
  { src: "/photo-row/run-club-1.jpg", alt: "A group finishing a morning run together", rotate: "rotate-3" },
  { src: "/photo-row/potluck-1.jpg", alt: "Friends sharing a potluck meal", rotate: "-rotate-5" },
  { src: "/photo-row/birthday-1.jpg", alt: "A group celebrating a birthday together", rotate: "rotate-6" },
];

export default function PhotoGrid() {
  return (
    <section className="py-16">
      <div className="flex justify-center gap-2 md:gap-1 overflow-x-auto no-scrollbar px-6">
        {PHOTOS.map((photo) => (
          <img
            key={photo.src}
            src={photo.src}
            alt={photo.alt}
            loading="lazy"
            className={`shrink-0 w-32 h-56 md:w-40 md:h-72 object-cover rounded-xl shadow-lg ${photo.rotate}`}
          />
        ))}
      </div>
    </section>
  );
}
```

Styling notes: alternating `rotate` classes (Tailwind's `rotate-N`/`-rotate-N` utilities) per card give the fanned-photo look from the reference; `shadow-lg` for the drop shadow; tight `gap-1`/`gap-2` with slight overlap rather than the generous spacing used elsewhere on the page, since overlap is core to the reference look; `rounded-xl` (slightly tighter radius than the page's usual `rounded-2xl` since these are small cards, not full-width panels). No `max-w-6xl` container here — `justify-center` lets the row center itself and this section intentionally doesn't match the page's usual container width, matching how Yorby's row reads as its own visual beat rather than boxed content.

## Image handling

The codebase does **not** use `next/image` anywhere (zero imports across `src`) — every image is a plain `<img>` with an eslint-disable for `@next/next/no-img-element`. **Follow that convention** for consistency rather than introducing `next/image` for just this one component; mixing patterns would be a bigger review conversation than this spec should force.

⚠️ Per [AGENTS.md](AGENTS.md), this repo runs a modified Next.js (16.2.2) where `next/image`'s docs (`node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md`) show a `preload` prop where you'd expect `priority`. This is only relevant if a future iteration switches this section to `next/image` for optimization — re-read that doc at that time rather than assuming standard `priority` semantics. Not a blocker for v1 since v1 uses plain `<img>`.

Images live flat in `public/`, e.g. `public/creators-hero.jpg` — this spec adds a `public/photo-row/` subfolder (first subfolder in `public/` for this project) to keep the new photo set from cluttering the flat structure further as more images are added. Target image count for v1: **8 photos**, matching the reference's row length closely enough to fill a desktop row without feeling sparse or overcrowded.

## Performance

- Export/compress source images before adding to `public/photo-row/` — target roughly 80–150 KB per photo at the display size (max rendered width ~160px @2x ≈ 320px, smaller than a full-bleed carousel card), not raw AI-generation-resolution PNGs. No build-time optimization pipeline exists in this repo (no `next/image`, no sharp step), so **compression is a manual step at asset-prep time**, not something the code does for you.
- `loading="lazy"` on all but perhaps the first 1–2 images, since this section sits below the fold-adjacent hero.

## Accessibility

- Every `<img>` needs a real, specific `alt` describing the scene (as in the example above) — not filler like `"photo"` or empty `alt=""`, since this section carries emotional/marketing meaning, not decoration.
- On mobile, horizontal scroll must remain keyboard/trackpad/touch-scrollable (native `overflow-x-auto`, no custom scroll-hijacking JS) — this falls out of reusing the existing pattern rather than building something bespoke. On desktop there's nothing to scroll, so no keyboard-interaction concerns beyond normal page flow.

## Rollout plan

1. Curate/compress 8 AI-generated photos, add to `public/photo-row/`
2. Build `src/app/personal/PhotoGrid.tsx` per the pattern above
3. Insert into `src/app/personal/page.tsx` after `PersonalHero`
4. Visual QA at mobile/tablet/desktop widths — confirm the row fits cleanly on desktop without scroll, and that the mobile scroll fallback doesn't look cramped or cut off mid-card
5. Confirm no layout shift against the hero/next section on load

## Open questions

1. Exact photo count and specific scenes/settings — left at "8, dinners/coffee walks/group hangouts" pending the actual generated set the user has in hand.
2. Whether to add a one-line pull quote above the row (as Yorby does) — not part of this spec's scope today, but a small, separable addition if wanted.
3. Whether this should eventually become a real testimonials section (photo + name + quote) once real customer photos exist — explicitly out of scope now per Non-goals, but worth revisiting once the "mix of both" sourcing path (mentioned as a future option) is in play.
4. Exact rotation angles/card size are eyeballed from the reference screenshot, not measured — a final visual pass against the live reference (once the browser tool is working, or via the screenshot already shared) should confirm/adjust before implementation.
