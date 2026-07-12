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
}

const NYC: DetectedCity = {
  city: "NYC",
  neighborhoods: ["Fort Greene", "Williamsburg", "the Lower East Side", "Park Slope"],
  fallback: false,
};

const CITY_BY_TIMEZONE: Record<string, DetectedCity> = {
  // US
  "America/New_York": NYC,
  "America/Detroit": {
    city: "Detroit",
    neighborhoods: ["Corktown", "Midtown", "Eastern Market"],
    fallback: false,
  },
  "America/Chicago": {
    city: "Chicago",
    neighborhoods: ["Wicker Park", "Logan Square", "the West Loop"],
    fallback: false,
  },
  "America/Denver": {
    city: "Denver",
    neighborhoods: ["RiNo", "Highlands", "Baker"],
    fallback: false,
  },
  "America/Phoenix": {
    city: "Phoenix",
    neighborhoods: ["Roosevelt Row", "Arcadia", "Melrose"],
    fallback: false,
  },
  "America/Los_Angeles": {
    city: "LA",
    neighborhoods: ["Silver Lake", "Highland Park", "Venice", "Echo Park"],
    fallback: false,
  },
  "America/Anchorage": {
    city: "Anchorage",
    neighborhoods: ["Downtown", "Midtown", "Spenard"],
    fallback: false,
  },
  "Pacific/Honolulu": {
    city: "Honolulu",
    neighborhoods: ["Kaka'ako", "Kailua", "Chinatown"],
    fallback: false,
  },
  // Canada
  "America/Toronto": {
    city: "Toronto",
    neighborhoods: ["Ossington", "Kensington Market", "Leslieville"],
    fallback: false,
  },
  "America/Vancouver": {
    city: "Vancouver",
    neighborhoods: ["Mount Pleasant", "Gastown", "Commercial Drive"],
    fallback: false,
  },
  // UK / EU seeds — if these ever ship, we've got the shapes ready.
  "Europe/London": {
    city: "London",
    neighborhoods: ["Peckham", "Hackney", "Notting Hill"],
    fallback: false,
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
    };
  }
}

/** True when the detected city is NYC (or when we defaulted to NYC).
 *  Used to gate the NYC-first seed-gallery hint. */
export function isNYC(city: DetectedCity): boolean {
  return city.city === "NYC";
}
