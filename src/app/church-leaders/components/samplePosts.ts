/**
 * Sample member posts — the copy that does the most work on this page.
 *
 * Register rules (spec §10): these must read like real people texting.
 * Lowercase, incomplete sentences, slightly awkward. The moment one of
 * these sounds like marketing copy, the whole "what shows up" section
 * stops being evidence and turns back into a claim. Nothing here should
 * be a worship service or a staff-planned event — showing a pastor the
 * calendar they already have defeats the point.
 */

export type Post = {
  /** Whose gathering it is. `kind: "group"` posts have no single owner. */
  who: string;
  /** Monogram shown in the avatar. Two chars max reads best. */
  initials: string;
  /** Avatar tint. Muted, non-branded — these are people, not the church. */
  tint: string;
  when: string;
  body: string;
  kind?: "person" | "group";
};

export const POSTS: Post[] = [
  {
    who: "Marcus",
    initials: "M",
    tint: "#40916c",
    when: "Saturday 8am",
    body: "walking the bridge before it gets hot. meet at the coffee place on the corner, come if you want.",
  },
  {
    who: "Priya",
    initials: "P",
    tint: "#b9791f",
    when: "Thursday 10am",
    body: "moms + strollers at the park by the library. bring whatever, no plan.",
  },
  {
    who: "The Delgados are moving",
    initials: "D",
    tint: "#2d6a4f",
    when: "Saturday 9am",
    body: "need two more sets of hands and a truck if anyone has one.",
    kind: "group",
  },
  {
    who: "Sam",
    initials: "S",
    tint: "#5a6b8c",
    when: "Friday 7pm",
    body: "board games at our place. first time doing this, no idea who'll come.",
  },
  {
    who: "After service",
    initials: "A",
    tint: "#8c5a5a",
    when: "Sunday 12:30",
    body: "trying the new ethiopian place on the corner. table for however many.",
    kind: "group",
  },
];

/** The three that carry the hero phone. Informality is the pitch. */
export const HERO_POSTS: Post[] = [POSTS[0], POSTS[3], POSTS[2]];
