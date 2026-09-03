// Cover art for the calendar grid.
//
// The spec wants real calendar cover photos here, and that remains the
// intended source. Until a featured-calendars endpoint serves them, the
// grid needs *something* per card, and the app's DEFAULT_COVERS are the
// wrong borrow: they're saturated primaries built for a zinc product UI
// and they shred this page's warm, low-contrast palette.
//
// These are the stand-in instead — desaturated washes drawn from the
// page's own tokens (forest, sage, clay, sand) so eight cards read as
// one set rather than a paint chart. Swap the whole module out for real
// photography when it exists.

export interface MarketingCover {
  gradient: string;
}

const COVERS: MarketingCover[] = [
  { gradient: "linear-gradient(150deg,#2f4a3a,#1d261f)" }, // deep forest
  { gradient: "linear-gradient(150deg,#7c9a7f,#4a6b52)" }, // sage
  { gradient: "linear-gradient(150deg,#c4a888,#8a6f56)" }, // clay
  { gradient: "linear-gradient(150deg,#9aa9ae,#5f7178)" }, // slate
  { gradient: "linear-gradient(150deg,#d8c9a8,#a8956f)" }, // sand
  { gradient: "linear-gradient(150deg,#8f7f96,#5c4f63)" }, // muted plum
  { gradient: "linear-gradient(150deg,#7fa39c,#4a6b66)" }, // muted teal
  { gradient: "linear-gradient(150deg,#b08c7d,#7a5c50)" }, // terracotta
];

/** Pick by grid position rather than by hashing the slug. Hashing looked
 *  tidier but collided — four adjacent cards drew the same green, which
 *  is the one outcome this palette can't afford. Position guarantees
 *  eight cards get eight different washes, and the grid order is stable
 *  within a render, so nothing flickers. */
export function coverFor(index: number): MarketingCover {
  return COVERS[((index % COVERS.length) + COVERS.length) % COVERS.length];
}
