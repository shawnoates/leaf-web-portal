// Client-side city detection for regionalizing prompt copy on /personal
// and /calendars. Uses the browser's IANA timezone as the signal —
// zero external calls, works offline, and is stable enough for
// swapping placeholder examples and empty-state hints.
//
// This is deliberately coarse. All of the US East Coast reports
// America/New_York, so a Boston or DC visitor lands on the "NYC" bucket.
// That's the correct default for us right now (NYC-first product), but
// it's the ceiling on timezone-only detection. If we ever need finer
// resolution we'd layer on IP headers server-side (CloudFront
// injects CloudFront-Viewer-City on Amplify) and read them via
// middleware into a cookie the client can consume.
//
// The city label shows up in copy like "Try 'date night in Fort Greene'"
// (NYC) vs "Try 'date night in Silver Lake'" (LA). Neighborhoods should
// be recognizable + specifically evocative, not the biggest downtown.

export interface DetectedCity {
  /** Human-readable city label used in copy. */
  city: string;
  /** Neighborhood examples used in placeholders. First is the strongest. */
  neighborhoods: string[];
  /** True when we couldn't identify a specific city — copy should fall
   *  back to "your neighborhood" style generics. */
  fallback: boolean;
  /** Downtown-ish center used to bias Ticketmaster event search and
   *  Google Places grounding on the server. Null when fallback=true. */
  lat: number | null;
  lng: number | null;
  /** Ready-to-tap prompt suggestions surfaced as chips on /personal.
   *  Each chip fires the generator via /calendars?q=<chip>, which
   *  regionalizes the resulting calendar to this city via the server
   *  originCity pass-through. Empty when fallback=true. */
  promptChips: string[];
}

const NYC: DetectedCity = {
  city: "NYC",
  neighborhoods: ["Fort Greene", "Williamsburg", "the Lower East Side", "Park Slope"],
  fallback: false,
  lat: 40.7128,
  lng: -74.006,
  promptChips: [
    "Date night in Fort Greene",
    "Thursday happy hours in Park Slope",
    "Williamsburg brunch spots",
    "Family fun in Brooklyn",
  ],
};

// Coords are downtown-ish centroids used as the biasing origin for
// Ticketmaster event search + Places areaHint. Not precise, and not
// meant to be — the search radius on the server side is generous
// (50 miles) and covers the whole metro from any of these anchors.
const CITY_BY_TIMEZONE: Record<string, DetectedCity> = {
  // US
  "America/New_York": NYC,
  "America/Detroit": {
    city: "Detroit",
    neighborhoods: ["Corktown", "Midtown", "Eastern Market"],
    fallback: false,
    lat: 42.3314,
    lng: -83.0458,
    promptChips: [
      "Date night in Corktown",
      "Weekend brunch in Midtown",
      "Eastern Market Saturday",
      "Family fun in Detroit",
    ],
  },
  "America/Chicago": {
    city: "Chicago",
    neighborhoods: ["Wicker Park", "Logan Square", "the West Loop"],
    fallback: false,
    lat: 41.8781,
    lng: -87.6298,
    promptChips: [
      "Date night in Wicker Park",
      "Logan Square happy hours",
      "West Loop brunch spots",
      "Family fun in Lincoln Park",
    ],
  },
  "America/Denver": {
    city: "Denver",
    neighborhoods: ["RiNo", "Highlands", "Baker"],
    fallback: false,
    lat: 39.7392,
    lng: -104.9903,
    promptChips: [
      "Date night in RiNo",
      "Highlands happy hours",
      "Baker brunch spots",
      "Family fun in Denver",
    ],
  },
  "America/Phoenix": {
    city: "Phoenix",
    neighborhoods: ["Roosevelt Row", "Arcadia", "Melrose"],
    fallback: false,
    lat: 33.4484,
    lng: -112.074,
    promptChips: [
      "Date night on Roosevelt Row",
      "Arcadia brunch spots",
      "Melrose happy hours",
      "Family fun in Phoenix",
    ],
  },
  "America/Los_Angeles": {
    city: "LA",
    neighborhoods: ["Silver Lake", "Highland Park", "Venice", "Echo Park"],
    fallback: false,
    lat: 34.0522,
    lng: -118.2437,
    promptChips: [
      "Date night in Silver Lake",
      "Echo Park happy hours",
      "Venice brunch spots",
      "Family fun in Highland Park",
    ],
  },
  "America/Anchorage": {
    city: "Anchorage",
    neighborhoods: ["Downtown", "Midtown", "Spenard"],
    fallback: false,
    lat: 61.2181,
    lng: -149.9003,
    promptChips: [
      "Date night downtown",
      "Spenard happy hours",
      "Midtown brunch spots",
      "Family fun in Anchorage",
    ],
  },
  "Pacific/Honolulu": {
    city: "Honolulu",
    neighborhoods: ["Kaka'ako", "Kailua", "Chinatown"],
    fallback: false,
    lat: 21.3069,
    lng: -157.8583,
    promptChips: [
      "Date night in Kaka'ako",
      "Kailua brunch spots",
      "Chinatown happy hours",
      "Family fun in Honolulu",
    ],
  },
  // Canada
  "America/Toronto": {
    city: "Toronto",
    neighborhoods: ["Ossington", "Kensington Market", "Leslieville"],
    fallback: false,
    lat: 43.6532,
    lng: -79.3832,
    promptChips: [
      "Date night on Ossington",
      "Kensington Market Saturday",
      "Leslieville brunch spots",
      "Family fun in Toronto",
    ],
  },
  "America/Vancouver": {
    city: "Vancouver",
    neighborhoods: ["Mount Pleasant", "Gastown", "Commercial Drive"],
    fallback: false,
    lat: 49.2827,
    lng: -123.1207,
    promptChips: [
      "Date night in Mount Pleasant",
      "Gastown happy hours",
      "Commercial Drive brunch spots",
      "Family fun in Vancouver",
    ],
  },
  // UK / EU seeds — if these ever ship, we've got the shapes ready.
  "Europe/London": {
    city: "London",
    neighborhoods: ["Peckham", "Hackney", "Notting Hill"],
    fallback: false,
    lat: 51.5074,
    lng: -0.1278,
    promptChips: [
      "Date night in Peckham",
      "Hackney happy hours",
      "Notting Hill brunch",
      "Family fun in London",
    ],
  },
};

/**
 * Read the browser's timezone and return a matching city bucket. Falls
 * back to a generic "your neighborhood" set when unrecognized. Safe to
 * call during SSR — returns the generic fallback (never NYC) so the
 * server-rendered markup doesn't leak a Fort Greene reference to a
 * Chicago visitor before hydration flips the copy.
 */
export function detectCity(): DetectedCity {
  if (typeof window === "undefined") {
    return {
      city: "your area",
      neighborhoods: ["your neighborhood", "your side of town"],
      fallback: true,
      lat: null,
      lng: null,
      promptChips: [],
    };
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return CITY_BY_TIMEZONE[tz] || {
      city: "your area",
      neighborhoods: ["your neighborhood", "your side of town"],
      fallback: true,
    };
  } catch {
    return {
      city: "your area",
      neighborhoods: ["your neighborhood", "your side of town"],
      fallback: true,
      lat: null,
      lng: null,
      promptChips: [],
    };
  }
}

/** True when the detected city is NYC (or when we defaulted to NYC).
 *  Used to gate the NYC-first seed-gallery hint. */
export function isNYC(city: DetectedCity): boolean {
  return city.city === "NYC";
}
