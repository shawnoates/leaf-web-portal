import { NextRequest, NextResponse } from "next/server";

const TMDB_API_KEY = process.env.TMDB_API_KEY || "";

// Map TMDB genre IDs to app categories
const GENRE_MAP: Record<number, string> = {
  28: "outdoors",   // Action
  12: "outdoors",   // Adventure
  16: "arts",       // Animation
  35: "arts",       // Comedy
  80: "arts",       // Crime
  99: "arts",       // Documentary
  18: "arts",       // Drama
  10751: "arts",    // Family
  14: "arts",       // Fantasy
  36: "arts",       // History
  27: "nightlife",  // Horror
  10402: "music",   // Music
  9648: "arts",     // Mystery
  10749: "arts",    // Romance
  878: "arts",      // Science Fiction
  53: "arts",       // Thriller
  10752: "arts",    // War
  37: "outdoors",   // Western
};

export async function GET(request: NextRequest) {
  if (!TMDB_API_KEY) {
    return NextResponse.json({ events: [] });
  }

  const query = request.nextUrl.searchParams.get("q");

  try {
    const url = query
      ? `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=1`
      : `https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_API_KEY}&region=US&page=1`;

    const res = await fetch(url, { headers: { Accept: "application/json" } });

    if (!res.ok) {
      return NextResponse.json({ events: [] });
    }

    const data = await res.json();
    const movies = (data.results || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((m: any) => query || m.vote_average >= 6.0)
      .slice(0, 10);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events = movies.map((m: any) => {
      const primaryGenre = m.genre_ids?.[0];
      const category = (primaryGenre && GENRE_MAP[primaryGenre]) || "arts";

      return {
        id: `tmdb-${m.id}`,
        title: m.title || "",
        description: m.overview || "",
        category,
        image: m.poster_path
          ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
          : null,
        source: "tmdb",
        url: `https://www.themoviedb.org/movie/${m.id}`,
        venue: null,
        suggestedDate: null,
        suggestedTime: null,
        capacityMin: null,
        capacityMax: null,
        suggestedDays: [],
        suggestedTimes: ["evening", "night"],
      };
    });

    return NextResponse.json({ events });
  } catch {
    return NextResponse.json({ events: [] });
  }
}
