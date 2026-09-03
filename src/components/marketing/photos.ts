// Photography for the marketing pages.
//
// Sourced through the existing `searchUnsplashPhotos` cloud function and
// baked in as constants rather than fetched at runtime: the spec calls for
// caching server-side and never calling Unsplash per page view, and these
// pages are statically prerendered. To refresh, re-run the search and
// replace the entries below.
//
// Every photo keeps its Unsplash attribution (credit + profile link), which
// UnsplashCredits renders in the footer.

export interface Photo {
  url: string;
  alt: string;
  credit: string;
  creditUrl: string;
}

/** Subject library. Keys are matched against a calendar's theme. */
export const PHOTOS = {
  dinner: {
    url: "https://images.unsplash.com/photo-1621112904887-419379ce6824?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwxfHxmcmllbmRzJTIwZGlubmVyJTIwcGFydHl8ZW58MHwwfHx8MTc4ODQxMTYzM3ww&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "A group of people at an outdoor dinner party with an oud on blankets",
    credit: "Considerate Agency",
    creditUrl: "https://unsplash.com/@considerateagency",
  },
  drinks: {
    url: "https://images.unsplash.com/photo-1580929753530-ef52238116c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwzfHx3aW5lJTIwYmFyfGVufDB8MHx8fDE3ODg0MTE1NjJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "wine bottle on brown wooden table",
    credit: "🇸🇮 Janko Ferlič",
    creditUrl: "https://unsplash.com/@itfeelslikefilm",
  },
  rooftop: {
    url: "https://images.unsplash.com/photo-1621275471769-e6aa344546d5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwzfHxyb29mdG9wJTIwYmFyfGVufDB8MHx8fDE3ODg0MTE2MzZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "brown wooden table and chairs set",
    credit: "Brands&People",
    creditUrl: "https://unsplash.com/@brandsandpeople",
  },
  weekend: {
    url: "https://images.unsplash.com/photo-1657222214001-2819cece6490?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwyfHxyb2FkJTIwdHJpcCUyMGZyaWVuZHN8ZW58MHwwfHx8MTc4ODQxMTY0MHww&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "people in a car",
    credit: "Christian Lue",
    creditUrl: "https://unsplash.com/@christianlue",
  },
  family: {
    url: "https://images.unsplash.com/photo-1599376672737-bd66af54c8f5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHw0fHxraWRzJTIwcGxheWdyb3VuZHxlbnwwfDB8fHwxNzg4NDExNTE4fDA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "2 boys sitting on red and black ride on toy car",
    credit: "Alexandr Podvalny",
    creditUrl: "https://unsplash.com/@freestockpro",
  },
  run: {
    url: "https://images.unsplash.com/photo-1607962837359-5e7e89f86776?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHw0fHxydW4lMjBjbHVifGVufDB8MHx8fDE3ODg0MTE0ODV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "man in black t-shirt and black shorts running on road during daytime",
    credit: "Gabin Vallet",
    creditUrl: "https://unsplash.com/@gabinvallet",
  },
  yoga: {
    url: "https://images.unsplash.com/photo-1588286840104-8957b019727f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHw0fHx5b2dhJTIwY2xhc3N8ZW58MHwwfHx8MTc4ODQxMTUxMHww&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "woman in white tank top and pink leggings doing yoga",
    credit: "Dylan Gillis",
    creditUrl: "https://unsplash.com/@mainermedia",
  },
  cycling: {
    url: "https://images.unsplash.com/photo-1631276893368-554b60393efb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHw0fHxjeWNsaW5nfGVufDB8MHx8fDE3ODg0MTE2MzV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "man in brown t-shirt riding on bicycle on road during daytime",
    credit: "David Dvořáček",
    creditUrl: "https://unsplash.com/@dafidvor",
  },
  skate: {
    url: "https://images.unsplash.com/photo-1496886077455-6e206da90837?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwxfHxza2F0ZXBhcmt8ZW58MHwwfHx8MTc4ODQxMTUyOXww&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "man doing trick at skateboard park during sunset",
    credit: "Robson Hatsukami Morgan",
    creditUrl: "https://unsplash.com/@robsonhmorgan",
  },
  books: {
    url: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHw0fHxib29rJTIwY2x1YnxlbnwwfDB8fHwxNzg4NDExNTM1fDA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "person picking white and red book on bookshelf",
    credit: "Christin Hume",
    creditUrl: "https://unsplash.com/@christinhumephoto",
  },
  music: {
    url: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwyfHxsaXZlJTIwbXVzaWMlMjB2ZW51ZXxlbnwwfDB8fHwxNzg4NDExNjQ0fDA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "people gathering on concert field",
    credit: "Danny Howe",
    creditUrl: "https://unsplash.com/@dannyhowe",
  },
  oysters: {
    url: "https://images.unsplash.com/photo-1633321094192-388268512e0f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwyfHxveXN0ZXJzfGVufDB8MHx8fDE3ODg0MTE2Mzd8MA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "a plate of oysters on ice with lemon wedges",
    credit: "Anima Visual",
    creditUrl: "https://unsplash.com/@animavisual",
  },
} satisfies Record<string, Photo>;

export type PhotoKey = keyof typeof PHOTOS;

// Calendar themes arrive freeform from the server ("datenight", "romantic",
// "exploration", "cocktails"…) alongside the seed pool's hyphenated ones, so
// match on keywords rather than an exact table. A theme that matches nothing
// deliberately gets no photo: the card falls back to its gradient wash, which
// is better than putting a confidently wrong subject on a real calendar.
const THEME_RULES: Array<[RegExp, PhotoKey]> = [
  [/date|romantic|dinner|supper|restaurant|food/i, "dinner"],
  [/happy.?hour|cocktail|wine|bar|drink|nightlife/i, "drinks"],
  [/rooftop|summer|patio/i, "rooftop"],
  [/weekend|getaway|escape|trip|explore|adventure|travel/i, "weekend"],
  [/family|kid|parent|toddler|playground/i, "family"],
  [/run|jog|marathon|race/i, "run"],
  [/yoga|pilates|wellness|meditat/i, "yoga"],
  [/bike|bicycle|cycl|ride/i, "cycling"],
  [/skate|board/i, "skate"],
  [/book|read|literar|writing/i, "books"],
  [/music|concert|show|band|dj|live/i, "music"],
  [/brunch|breakfast|coffee/i, "dinner"],
];

/** The photo for a calendar theme, or null when nothing matches. */
export function photoForTheme(theme: string | null | undefined): Photo | null {
  if (!theme) return null;
  for (const [re, key] of THEME_RULES) {
    if (re.test(theme)) return PHOTOS[key];
  }
  return null;
}

/** Venue thumbnails for the RSVP demo card, in row order. */
export const DEMO_VENUE_PHOTOS: Photo[] = [
  PHOTOS.drinks,
  PHOTOS.rooftop,
  PHOTOS.oysters,
];

/** The unifying grade the spec asks for, so a page of photos from a dozen
 *  different photographers still reads as one set. */
export const PHOTO_FILTER = "saturate(.9) contrast(1.02)";

/** Every photo actually shown, de-duplicated by photographer, for the
 *  footer credit line Unsplash's guidelines ask for. */
export function allCredits(): Array<{ credit: string; creditUrl: string }> {
  const seen = new Set<string>();
  const out: Array<{ credit: string; creditUrl: string }> = [];
  for (const p of Object.values(PHOTOS) as Photo[]) {
    if (seen.has(p.creditUrl)) continue;
    seen.add(p.creditUrl);
    out.push({ credit: p.credit, creditUrl: p.creditUrl });
  }
  return out;
}
