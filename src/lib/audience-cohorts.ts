/**
 * Audience cohorts — who a plan suggestion is aimed at.
 *
 * MUST stay in sync with leaflets-server/cloud/audience-cohorts.js and
 * leaf-admin-portal/src/lib/audience-cohorts.ts.
 *
 * Deliberately maps `any` to null rather than "Everyone": a chip on every card
 * makes the targeted cards stop standing out, and standing out is the whole
 * reason the tag exists. Unknown values also fall through to null, so a cohort
 * added server-side before it lands here degrades to no chip rather than
 * rendering a raw slug like "parents_kids" at a visitor.
 */
export const AUDIENCE_COHORT_LABELS: Record<string, string | undefined> = {
  any: undefined,
  moms: "Moms",
  dads: "Dads",
  parents_kids: "Families",
  young_prof: "Young professionals",
  seniors: "Seniors",
  pets: "Dog owners",
  sober: "Sober",
};
