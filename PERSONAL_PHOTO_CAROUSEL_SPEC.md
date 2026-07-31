# Personal Page Photo Carousel — Specification

## Goal

Add a horizontally-scrolling carousel of real-life-looking photos — people having fun together in a group — to `/personal` (`os.joinleaf.com/personal`), immediately after the hero. This is a social-proof/emotional-hook section: right now the hero sells the AI-prompt generator, and the very next thing visitors see ("Who it's for") is a text block. A carousel of warm, candid-feeling group photos closes that gap before the copy does the explaining, similar in spirit to yorby.ai's use of lifestyle photography up top.

## Non-goals (v1)

- No swipe/carousel library dependency (Embla, Swiper, etc.) — see [Component approach](#component-approach)
- No autoplay/ken-burns animation — v1 is user-driven horizontal scroll only
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

{/* Photo carousel — new section */}
<PhotoCarousel />

{/* Who it's for */}
<section className="py-24">
  ...
```

## Component approach

The codebase has **no carousel/slider library** installed (confirmed via grep across `src` and `package.json`) and **no existing `components/ui` directory**. It does, however, have a de-facto horizontal-scroll convention already used in [`src/components/DealsStrip.tsx`](src/components/DealsStrip.tsx) and several other places:

```tsx
<div className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-4 -mx-6 px-6">
  {items.map((item) => (
    <Card key={item.id} className="snap-start ..." />
  ))}
</div>
```

`.no-scrollbar` is already defined in [`globals.css`](src/app/globals.css:8) with the comment "Hide scrollbar for carousels" — this project's established pattern for this exact use case. **Reuse it rather than adding a new dependency.** No JS-driven autoplay/dot-indicator logic needed for v1; it's a native scroll-snap strip, same as the rest of the app.

New file: `src/app/personal/PhotoCarousel.tsx` (co-located with `PersonalHero.tsx`, same pattern):

```tsx
const CAROUSEL_PHOTOS = [
  { src: "/carousel/group-dinner-1.jpg", alt: "Friends laughing at a dinner table" },
  { src: "/carousel/coffee-walk-1.jpg", alt: "A small group on a coffee walk" },
  // ...
];

export default function PhotoCarousel() {
  return (
    <section className="py-16">
      <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-4 -mx-6 px-6 max-w-6xl mx-auto">
        {CAROUSEL_PHOTOS.map((photo) => (
          <img
            key={photo.src}
            src={photo.src}
            alt={photo.alt}
            className="snap-start shrink-0 w-72 h-96 md:w-80 md:h-[26rem] object-cover rounded-2xl"
          />
        ))}
      </div>
    </section>
  );
}
```

Styling notes to match the rest of `/personal`: `rounded-2xl` (not the button `rounded-full`, but consistent with the soft, generous feel of the page), `max-w-6xl mx-auto px-6` container matching every other section, `py-16` (slightly tighter than the `py-24`/`py-32` content sections since this is a visual breather, not a content block).

## Image handling

The codebase does **not** use `next/image` anywhere (zero imports across `src`) — every image is a plain `<img>` with an eslint-disable for `@next/next/no-img-element`. **Follow that convention** for consistency rather than introducing `next/image` for just this one component; mixing patterns would be a bigger review conversation than this spec should force.

⚠️ Per [AGENTS.md](AGENTS.md), this repo runs a modified Next.js (16.2.2) where `next/image`'s docs (`node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md`) show a `preload` prop where you'd expect `priority`. This is only relevant if a future iteration switches this section to `next/image` for optimization — re-read that doc at that time rather than assuming standard `priority` semantics. Not a blocker for v1 since v1 uses plain `<img>`.

Images live flat in `public/`, e.g. `public/creators-hero.jpg` — this spec adds a `public/carousel/` subfolder (first subfolder in `public/` for this project) to keep the new photo set from cluttering the flat structure further as more images are added. Reasonable image count for v1: **6–10 photos**, enough to make the strip feel full on desktop and give mobile users several swipes without repeats.

## Performance

- Export/compress source images before adding to `public/carousel/` — target roughly 150–300 KB per photo at the display size (max rendered width ~320px @2x ≈ 640px), not raw AI-generation-resolution PNGs. No build-time optimization pipeline exists in this repo (no `next/image`, no sharp step), so **compression is a manual step at asset-prep time**, not something the code does for you.
- `loading="lazy"` on all but perhaps the first 1–2 images, since this section sits below the fold-adjacent hero.

## Accessibility

- Every `<img>` needs a real, specific `alt` describing the scene (as in the example above) — not filler like `"photo"` or empty `alt=""`, since this section carries emotional/marketing meaning, not decoration.
- Horizontal scroll must remain keyboard/trackpad-scrollable (native `overflow-x-auto`, no custom scroll-hijacking JS) — this falls out of reusing the existing pattern rather than building something bespoke.

## Rollout plan

1. Curate/compress 6–10 AI-generated photos, add to `public/carousel/`
2. Build `src/app/personal/PhotoCarousel.tsx` per the pattern above
3. Insert into `src/app/personal/page.tsx` after `PersonalHero`
4. Visual QA at mobile/tablet/desktop widths — confirm snap behavior feels right and the strip doesn't look cramped/overflowing on small screens
5. Confirm no layout shift against the hero/next section on load

## Open questions

1. Exact photo count and specific scenes/settings — left at "6–10, dinners/coffee walks/group hangouts" pending the actual generated set the user has in hand.
2. Whether this should eventually become a real testimonials section (photo + name + quote) once real customer photos exist — explicitly out of scope now per Non-goals, but worth revisiting once the "mix of both" sourcing path (mentioned as a future option) is in play.
3. Should the strip have any subtle left/right arrow affordance on desktop (where drag-scroll is less discoverable than on touch), or is unadorned scroll-snap sufficient? Existing `DealsStrip`-style precedent in this codebase has no arrows, so v1 assumes none — flag if that convention should be revisited for this specific section.
