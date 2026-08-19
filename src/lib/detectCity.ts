// City detection for regionalizing prompt copy on /personal and
// /calendars.
//
// Two signals, in priority order:
//
//  1. Where the request physically came from — CloudFront viewer geo
//     headers, read through /api/geo. This is the truth: it survives
//     travel, a laptop clock left on the wrong zone, and auto-timezone
//     being off.
//  2. The browser's IANA timezone. Instant and offline, but it describes
//     the *device*, not the person. Kept as the immediate first paint and
//     as the fallback when the edge tells us nothing.
//
// Both are deliberately coarse. All of the US East Coast reports
// America/New_York, so a Boston or DC visitor lands on the "NYC" bucket.
// That's the correct default for us right now (NYC-first product), and
// it's the ceiling on timezone-shaped resolution either way — the edge
// headers also carry lat/lng, so a viewer near a known metro snaps to
// that bucket by distance rather than by zone.
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
   *  Google Places grounding on the server. Null when we have neither a
   *  bucket match nor edge coordinates. */
  lat: number | null;
  lng: number | null;
  /** Ready-to-tap prompt suggestions surfaced as chips on /personal.
   *  Each chip fires the generator via /calendars?q=<chip>, which
   *  regionalizes the resulting calendar to this city via the server
   *  originCity pass-through. Empty when fallback=true. */
  promptChips: string[];
  /** A city name we're confident enough to send to the server as
   *  originCity. Set even when fallback=true, which happens when the edge
   *  names a real city we have no neighborhood copy for — Austin still
   *  deserves Austin venues, it just gets generic placeholder text. */
  resolvedCity: string | null;
  /** Which signal produced this. "geo" = viewer IP at the CDN edge,
   *  "timezone" = device clock, "fallback" = neither answered. */
  source: "geo" | "timezone" | "fallback";
}

/** A city bucket as authored below. `resolvedCity`/`source` are attached
 *  at read time by whichever signal matched, so the table stays plain. */
type CityBucket = Omit<DetectedCity, "resolvedCity" | "source">;

/** SSR-safe, signal-free default. Also the shape every consumer should
 *  use for initial state so the server-rendered markup never leaks a
 *  Fort Greene reference to a Chicago visitor. */
export const GENERIC_CITY: DetectedCity = Object.freeze({
  city: "your area",
  neighborhoods: ["your neighborhood", "your side of town"],
  fallback: true,
  lat: null,
  lng: null,
  promptChips: [],
  resolvedCity: null,
  source: "fallback",
}) as DetectedCity;

const NYC: CityBucket = {
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
const CITY_BY_TIMEZONE: Record<string, CityBucket> = {
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

/** Extra names that should land on an existing bucket. Used only when the
 *  edge gives us a city name but no usable coordinates. */
const CITY_NAME_ALIASES: Record<string, string> = {
  "new york": "America/New_York",
  brooklyn: "America/New_York",
  manhattan: "America/New_York",
  queens: "America/New_York",
  bronx: "America/New_York",
  "los angeles": "America/Los_Angeles",
  "long beach": "America/Los_Angeles",
  pasadena: "America/Los_Angeles",
};

/** How close a viewer has to be to a bucket's centroid for that bucket's
 *  neighborhood copy to be honest. 60km covers a metro (Burnaby → Vancouver,
 *  Evanston → Chicago) without claiming Hamilton is Toronto's Ossington. */
const BUCKET_RADIUS_KM = 60;

function attach(
  bucket: CityBucket,
  source: "geo" | "timezone"
): DetectedCity {
  return { ...bucket, resolvedCity: bucket.city, source };
}

function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Viewer geolocation as /api/geo reports it. Every field is optional —
 *  the edge fills in what it knows about the request's IP. */
export interface EdgeGeo {
  city?: string | null;
  region?: string | null;
  country?: string | null;
  timeZone?: string | null;
  lat?: number | null;
  lng?: number | null;
  available?: boolean;
}

/**
 * Map edge geolocation onto a city bucket. Returns null when the payload
 * says nothing useful, so callers can keep whatever they already had.
 *
 * Order matters: the edge timezone is an exact key into the table we
 * already maintain; coordinates resolve the metros that share a zone;
 * the name is the last resort because "Vancouver" is also a city in
 * Washington State.
 */
export function cityFromGeo(geo: EdgeGeo | null | undefined): DetectedCity | null {
  if (!geo) return null;

  if (geo.timeZone && CITY_BY_TIMEZONE[geo.timeZone]) {
    return attach(CITY_BY_TIMEZONE[geo.timeZone], "geo");
  }

  const lat = typeof geo.lat === "number" ? geo.lat : null;
  const lng = typeof geo.lng === "number" ? geo.lng : null;

  if (lat !== null && lng !== null) {
    let best: CityBucket | null = null;
    let bestKm = Infinity;
    for (const bucket of Object.values(CITY_BY_TIMEZONE)) {
      if (bucket.lat === null || bucket.lng === null) continue;
      const km = distanceKm(lat, lng, bucket.lat, bucket.lng);
      if (km < bestKm) {
        bestKm = km;
        best = bucket;
      }
    }
    if (best && bestKm <= BUCKET_RADIUS_KM) return attach(best, "geo");
  }

  const name = geo.city?.trim().toLowerCase();
  if (name && lat === null) {
    const tz =
      CITY_NAME_ALIASES[name] ||
      Object.keys(CITY_BY_TIMEZONE).find(
        (key) => CITY_BY_TIMEZONE[key].city.toLowerCase() === name
      );
    if (tz) return attach(CITY_BY_TIMEZONE[tz], "geo");
  }

  // A real place we have no copy for. Generic placeholders, but the city
  // name and coordinates still reach the generator so the venues are local.
  if (geo.city || (lat !== null && lng !== null)) {
    return {
      ...GENERIC_CITY,
      city: geo.city || GENERIC_CITY.city,
      lat,
      lng,
      resolvedCity: geo.city || null,
      source: "geo",
    };
  }

  return null;
}

// Resolved edge geo, cached for the page's lifetime. Populated by
// primeGeoCity() and read by detectCity() so imperative callers (event
// handlers that just want "where is this person") get the good answer
// without threading state through.
let cachedGeoCity: DetectedCity | null = null;
let geoRequest: Promise<DetectedCity | null> | null = null;

/**
 * Fetch viewer geolocation from the edge once per page load. Concurrent
 * callers share the one request; failures are cached as "no answer" and
 * leave the timezone guess in place rather than retrying on every render.
 */
export function primeGeoCity(): Promise<DetectedCity | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (cachedGeoCity) return Promise.resolve(cachedGeoCity);
  if (geoRequest) return geoRequest;

  geoRequest = (async () => {
    try {
      const res = await fetch("/api/geo", {
        cache: "no-store",
        // Don't let a stalled edge hold up anything gated on `ready` —
        // /calendars blocks generation until geo settles.
        signal:
          typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
            ? AbortSignal.timeout(2500)
            : undefined,
      });
      if (!res.ok) return null;
      const geo = (await res.json()) as EdgeGeo;
      const city = cityFromGeo(geo);
      if (city) cachedGeoCity = city;
      return city;
    } catch {
      return null;
    }
  })();

  return geoRequest;
}

/**
 * Best city we currently know. Returns edge geolocation once it has
 * resolved, otherwise the browser timezone, otherwise generics. Safe to
 * call during SSR — returns the generic fallback (never NYC) so the
 * server-rendered markup doesn't leak a Fort Greene reference to a
 * Chicago visitor before hydration flips the copy.
 *
 * Prefer useDetectedCity() in components: this is synchronous, so before
 * /api/geo lands it can only answer with the device timezone.
 */
export function detectCity(): DetectedCity {
  if (typeof window === "undefined") return GENERIC_CITY;
  if (cachedGeoCity) return cachedGeoCity;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const bucket = CITY_BY_TIMEZONE[tz];
    return bucket ? attach(bucket, "timezone") : GENERIC_CITY;
  } catch {
    return GENERIC_CITY;
  }
}

/** True when the detected city is NYC (or when we defaulted to NYC).
 *  Used to gate the NYC-first seed-gallery hint. */
export function isNYC(city: DetectedCity): boolean {
  return city.city === "NYC";
}
