// Choosing which real calendars are fit to show as the homepage's social
// proof.
//
// `listAICalendarsByCity` sorts by adoptionCount and filters on
// `originCity`, which is *where the visitor was when they generated the
// calendar* — not what the calendar is about. So the "NYC" bucket
// legitimately contains a Chicago weekend, a Paris date night and a
// Vancouver trip. Fine for the /calendars gallery; wrong for a page whose
// whole claim is "real calendars made by real planners, below."
//
// Everything here is client-side on purpose: the fix needs no server
// deploy, and the endpoint already returns enough rows to filter down.

export interface FeaturedRow {
  slug: string;
  title: string;
  prompt: string;
  area: string | null;
  theme: string | null;
  adoptionCount: number;
  coverImageUrl?: string | null;
  events?: Array<{ time: string; title?: string; name: string; tag: string }>;
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/**
 * True when a title names a month that has already gone by — "June Date
 * Night Ideas" surfacing in September. The generator stamps the month it
 * ran in, and the events themselves are stored as weekday + time
 * ("Sat · 8:30 PM"), so the calendar is evergreen and only its *title* has
 * expired. Nothing downstream can repair that, so these are dropped.
 *
 * A month later in the calendar year than today is left alone: "December
 * Date Nights" seen in September is a plan, not a leftover.
 */
export function hasStaleMonth(title: string, now: Date = new Date()): boolean {
  const lower = title.toLowerCase();
  const currentMonth = now.getMonth();
  for (let i = 0; i < MONTHS.length; i++) {
    // \b so "March" matches but "Marching Band" doesn't, and "May" — a
    // month that is also an ordinary word — only counts when capitalised
    // in the original title, which the generator always does.
    const re = new RegExp(`\\b${MONTHS[i]}\\b`, "i");
    if (!re.test(lower)) continue;
    if (MONTHS[i] === "may" && !new RegExp("\\bMay\\b").test(title)) continue;
    if (i < currentMonth) return true;
  }
  return false;
}

/** The tokens that identify a metro, so "Park Slope, NYC" and "Brooklyn,
 *  NYC" both read as belonging to a New York visitor. */
function areaTokens(area: string): string[] {
  return area
    .toLowerCase()
    .split(/[,/]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * True when a calendar's own `area` places it in the visitor's metro.
 *
 * Matching is on the area string rather than `originCity` because that is
 * the field describing the calendar rather than its author's location.
 * When we can't tell where the visitor is, everything passes — a full grid
 * of somewhere-else calendars still beats an empty one.
 */
export function isNearVisitor(
  area: string | null,
  visitorCity: string | null,
  visitorNeighborhoods: string[] = []
): boolean {
  if (!visitorCity) return true;
  if (!area) return false;

  const tokens = areaTokens(area);
  const needles = [visitorCity, ...visitorNeighborhoods]
    .filter(Boolean)
    .map((s) => s.toLowerCase().trim());

  // NYC rows write the metro a dozen ways; treat the borough names as
  // aliases of the city itself so a Brooklyn calendar counts for an NYC
  // visitor and vice versa.
  const NYC_ALIASES = [
    "nyc",
    "new york",
    "new york city",
    "brooklyn",
    "manhattan",
    "queens",
    "bronx",
  ];
  const visitorIsNyc = needles.some((n) => NYC_ALIASES.includes(n));

  return tokens.some((t) => {
    if (visitorIsNyc && NYC_ALIASES.includes(t)) return true;
    return needles.some((n) => t === n || t.includes(n) || n.includes(t));
  });
}

/**
 * The rows worth featuring: local to the visitor, not stale, deduplicated
 * by title, best-adopted first.
 *
 * Falls back to the un-localised list rather than returning nothing — a
 * visitor in a metro with no calendars yet should still see the grid full,
 * since the section's job is to prove the product makes real calendars.
 */
export function selectFeatured(
  rows: FeaturedRow[],
  opts: {
    visitorCity: string | null;
    visitorNeighborhoods?: string[];
    limit: number;
    now?: Date;
  }
): FeaturedRow[] {
  const now = opts.now ?? new Date();
  const seenTitle = new Set<string>();

  const fresh = rows.filter((r) => {
    if (!r.slug || !r.title) return false;
    if (hasStaleMonth(r.title, now)) return false;
    const key = r.title.trim().toLowerCase();
    if (seenTitle.has(key)) return false;
    seenTitle.add(key);
    return true;
  });

  const local = fresh.filter((r) =>
    isNearVisitor(r.area, opts.visitorCity, opts.visitorNeighborhoods)
  );

  const chosen =
    local.length >= opts.limit
      ? local
      : [...local, ...fresh.filter((r) => !local.includes(r))];

  const ranked = [...chosen].sort(
    (a, b) => (b.adoptionCount || 0) - (a.adoptionCount || 0)
  );

  return spreadByTheme(ranked, opts.limit);
}

/**
 * Take one calendar per theme before taking a second of any, preserving
 * rank within each theme.
 *
 * Straight rank order gives a monotonous grid: every row currently has an
 * adoptionCount of 1, so "best adopted first" is really insertion order,
 * and New York's happen to be six date-night/happy-hour calendars in a
 * row. It also starves the cover photography, which allocates a distinct
 * image per card from a per-theme pool.
 */
function spreadByTheme(rows: FeaturedRow[], limit: number): FeaturedRow[] {
  const byTheme = new Map<string, FeaturedRow[]>();
  for (const r of rows) {
    const key = (r.theme || "other").toLowerCase();
    const list = byTheme.get(key);
    if (list) list.push(r);
    else byTheme.set(key, [r]);
  }

  const queues = [...byTheme.values()];
  const out: FeaturedRow[] = [];
  let progressed = true;
  while (out.length < limit && progressed) {
    progressed = false;
    for (const q of queues) {
      if (out.length >= limit) break;
      const next = q.shift();
      if (!next) continue;
      out.push(next);
      progressed = true;
    }
  }
  return out;
}
