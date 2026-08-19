// Hand-curated seed calendars for the AI-generator gallery. Used by
// /personal (chip preview strip) and /calendars (gallery grid) so both
// surfaces show the same starter supply while the real cached-calendar
// table is populated.
//
// Each entry represents what the Phase 1 real schema will store on
// `AICalendar` — title, prompt, area, theme, event list. `adoptionCount`
// is the seeded starter number from the cold-start spec (10–15 range so
// ranking has ground truth on day one; real adoptions push these up).

export interface SeedEvent {
  tag: string;
  tagVariant?: "default" | "amber";
  // Catchy activity headline ("Intimate Dinner"). Optional: the curated
  // seeds and pre-title AICalendar rows fall back to `name`.
  title?: string;
  name: string;
  time: string;
  venueLine: string;
}

export interface SeedCalendar {
  slug: string;
  // Short label used on the /personal chip row.
  chipLabel: string;
  // Full-page title on /c/<slug>.
  title: string;
  // Original prompt text — what the visitor typed / would type to
  // arrive at this calendar.
  prompt: string;
  // Neighborhood / metro area used for area matching in Phase 5
  // planning-engine feed.
  area: string;
  // Vibe/category cluster.
  theme: string;
  // Compact eyebrow shown on preview cards ("5 nights, 4 stops").
  previewKicker: string;
  // Attribution line for the community-source of the seed. When Phase
  // 5 wires the planning-engine feed, real seed sources replace this.
  sourceName: string;
  // Starter number so gallery ranking works before real adoptions land.
  adoptionCount: number;
  events: SeedEvent[];
}

export const SEED_POOL: SeedCalendar[] = [
  {
    slug: "family-fun-this-month",
    chipLabel: "Family fun this month",
    title: "Family fun · Brooklyn",
    prompt: "Family fun in Brooklyn this month",
    area: "Brooklyn",
    theme: "family",
    previewKicker: "Preview · 4 weekends",
    sourceName: "Brooklyn Parents Group",
    adoptionCount: 147,
    events: [
      {
        tag: "Museum",
        name: "Brooklyn Children's Museum",
        time: "Sat · 10:30 AM",
        venueLine: "145 Brooklyn Ave",
      },
      {
        tag: "Outdoor",
        name: "Prospect Park Zoo",
        time: "Sun · 11:00 AM",
        venueLine: "450 Flatbush Ave",
      },
      {
        tag: "Workshop",
        name: "Powerhouse Arena Kids Story Hour",
        time: "Sat · 11:00 AM",
        venueLine: "28 Adams St",
      },
      {
        tag: "Play",
        tagVariant: "amber",
        name: "Kolo Klub",
        time: "Sun · 2:00 PM",
        venueLine: "142 Sackett St · indoor",
      },
    ],
  },
  {
    slug: "fort-greene-date-night",
    chipLabel: "Date night in Fort Greene",
    title: "Fort Greene · Date night",
    prompt: "Date night spots in Fort Greene",
    area: "Fort Greene, Brooklyn",
    theme: "date-night",
    previewKicker: "Preview · 5 nights, 4 stops",
    sourceName: "Fort Greene Regulars",
    adoptionCount: 213,
    events: [
      {
        tag: "Cocktails",
        name: "Bar Camillo",
        time: "Fri · 7:30 PM",
        venueLine: "210 Grand Ave",
      },
      {
        tag: "Dinner",
        name: "Cafe Erzulie",
        time: "Fri · 8:30 PM",
        venueLine: "894 Fulton St · Haitian",
      },
      {
        tag: "Dinner",
        name: "Roman's",
        time: "Sat · 8:00 PM",
        venueLine: "243 DeKalb Ave · Italian, walk-in",
      },
      {
        tag: "Nightcap",
        tagVariant: "amber",
        name: "The Great Georgiana",
        time: "Sat · 11:00 PM",
        venueLine: "351 Grand Ave · Natural wine",
      },
    ],
  },
  {
    slug: "park-slope-thursday-happy-hours",
    chipLabel: "Thursday happy hours · Park Slope",
    title: "Thursday happy hours · Park Slope",
    prompt: "Thursday happy hours in Park Slope",
    area: "Park Slope, Brooklyn",
    theme: "happy-hour",
    previewKicker: "Preview · every Thursday",
    sourceName: "Park Slope After-Work",
    adoptionCount: 89,
    events: [
      {
        tag: "Beer",
        name: "Union Hall",
        time: "Thu · 5:30 PM",
        venueLine: "702 Union St · $6 pints",
      },
      {
        tag: "Wine",
        name: "Sea Witch",
        time: "Thu · 6:30 PM",
        venueLine: "703 Sackett St · $8 glasses",
      },
      {
        tag: "Cocktails",
        name: "Bar Toto",
        time: "Thu · 7:30 PM",
        venueLine: "411 11th St · half-off apps",
      },
      {
        tag: "Snacks",
        tagVariant: "amber",
        name: "Talde",
        time: "Thu · 8:30 PM",
        venueLine: "369 7th Ave · Asian-American",
      },
    ],
  },
  {
    slug: "williamsburg-brunch",
    chipLabel: "Williamsburg brunch",
    title: "Williamsburg · Brunch crawl",
    prompt: "Brunch spots in Williamsburg",
    area: "Williamsburg, Brooklyn",
    theme: "brunch",
    previewKicker: "Preview · 4 Sundays",
    sourceName: "North Brooklyn Weekends",
    adoptionCount: 178,
    events: [
      {
        tag: "Brunch",
        name: "Sunday in Brooklyn",
        time: "Sun · 10:30 AM",
        venueLine: "348 Wythe Ave · pancakes",
      },
      {
        tag: "Pastry",
        name: "Radio Bakery",
        time: "Sun · 9:00 AM",
        venueLine: "135 India St · morning buns",
      },
      {
        tag: "Coffee",
        name: "Sey Coffee",
        time: "Sun · 11:00 AM",
        venueLine: "18 Grattan St · roaster",
      },
      {
        tag: "Cocktails",
        tagVariant: "amber",
        name: "Diner",
        time: "Sun · 12:30 PM",
        venueLine: "85 Broadway · bloody marys",
      },
    ],
  },
  {
    slug: "lower-east-side-first-date",
    chipLabel: "LES first date",
    title: "Lower East Side · First date",
    prompt: "First date spots on the Lower East Side",
    area: "Lower East Side, Manhattan",
    theme: "date-night",
    previewKicker: "Preview · 5 stops",
    sourceName: "LES After Six",
    adoptionCount: 156,
    events: [
      {
        tag: "Wine",
        name: "Ten Bells",
        time: "Fri · 7:00 PM",
        venueLine: "247 Broome St · natural wine bar",
      },
      {
        tag: "Dinner",
        name: "Cervo's",
        time: "Fri · 8:30 PM",
        venueLine: "43 Canal St · Portuguese",
      },
      {
        tag: "Cocktails",
        name: "Attaboy",
        time: "Sat · 10:00 PM",
        venueLine: "134 Eldridge St · unmarked door",
      },
      {
        tag: "Dessert",
        tagVariant: "amber",
        name: "Il Laboratorio del Gelato",
        time: "Sat · 11:00 PM",
        venueLine: "188 Ludlow St",
      },
    ],
  },
];

// Rotate up to N picks from the pool. Callers memoize the result per
// mount so re-renders don't shuffle mid-interaction. Deterministic
// seeding (once we have session ids) can replace Math.random() so a
// visitor's second pageview shows the same rotation they engaged with.
export function pickSeeds(count: number, pool: SeedCalendar[] = SEED_POOL): SeedCalendar[] {
  const copy = [...pool];
  const picks: SeedCalendar[] = [];
  while (picks.length < Math.min(count, pool.length) && copy.length) {
    picks.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return picks;
}

export function findSeed(slug: string): SeedCalendar | null {
  return SEED_POOL.find((c) => c.slug === slug) || null;
}
