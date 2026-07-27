// Venue-blacklist matching shared by the org public page and the dashboard's
// Host-a-suggestion modal so both filter Google Places results identically.
//
// Places `types` strings and lowercase name keywords used to filter venue
// search results. Categories without reliable Places types fall back to
// keyword matching against the venue name.
export const BLACKLIST_TYPE_MAP: Record<string, { types: string[]; keywords: string[] }> = {
  "Bars": { types: ["bar"], keywords: ["bar", "pub", "tavern", "brewery", "brewpub"] },
  "Nightclubs": { types: ["night_club"], keywords: ["nightclub", "night club", "lounge", "club"] },
  "Casinos": { types: ["casino"], keywords: ["casino"] },
  "Adult venues": { types: [], keywords: ["adult", "strip", "gentlemen", "xxx"] },
  "Smoking lounges": { types: [], keywords: ["hookah", "cigar", "smoke shop", "vape", "smoking"] },
  "Religious venues": {
    types: ["church", "synagogue", "mosque", "hindu_temple", "place_of_worship"],
    keywords: ["church", "synagogue", "mosque", "temple", "chapel", "cathedral"],
  },
  "Late-night venues": { types: [], keywords: ["late night", "after hours"] },
  "Fast food": {
    types: ["meal_takeaway"],
    keywords: ["mcdonald", "burger king", "wendy", "taco bell", "kfc", "subway", "chipotle", "popeyes", "arby", "sonic", "hardee", "carl's jr", "jack in the box", "white castle", "dairy queen", "fast food"],
  },
};

export function isVenueBlacklisted(
  name: string,
  types: string[],
  blacklistCategories: string[],
  excludeKeywords?: string[]
): boolean {
  const lowerName = name.toLowerCase();
  // Check preset category blacklist
  if (blacklistCategories && blacklistCategories.length > 0) {
    const typeSet = new Set(types);
    for (const category of blacklistCategories) {
      const entry = BLACKLIST_TYPE_MAP[category];
      if (!entry) continue;
      if (entry.types.some((t) => typeSet.has(t))) return true;
      if (entry.keywords.some((k) => lowerName.includes(k))) return true;
    }
  }
  // Check custom excluded keywords
  if (excludeKeywords && excludeKeywords.length > 0) {
    for (const kw of excludeKeywords) {
      if (lowerName.includes(kw.toLowerCase())) return true;
    }
  }
  return false;
}
