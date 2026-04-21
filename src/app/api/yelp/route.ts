import { NextRequest, NextResponse } from "next/server";

const YELP_API_KEY = process.env.YELP_API_KEY || "";

// Categories people would actually want to visit as a group
const GROUP_CATEGORIES = [
  "restaurants",
  "bars",
  "museums",
  "parks",
].join(",");

// Map Yelp categories to app categories
function mapCategory(categories: { alias: string; title: string }[]): string {
  const aliases = categories.map((c) => c.alias).join(",");
  if (/restaurant|food|dining|brunch|breakfast|lunch|dinner|cafe|coffee|bakeries|pizza|sushi|mexican|italian|chinese|thai/.test(aliases)) return "dining";
  if (/sport|recreation|stadiums|basketball|soccer|bowling|gokarts|paintball|laser_tag|skating|surfing|climbing|boating/.test(aliases)) return "sports";
  if (/music|concert|dj|karaoke|musicvenues|jazz|comedyclubs/.test(aliases)) return "music";
  if (/art|gallery|museum|theater|theatre|film|cinema|performing|pottery|cookingclasses/.test(aliases)) return "arts";
  if (/nightlife|bar|pub|club|lounge|brewery|wine_bars|cocktailbars|winetastingroom/.test(aliases)) return "nightlife";
  if (/park|hik|outdoor|garden|beach|nature|camping|playground|mini_golf|boating|surfing/.test(aliases)) return "outdoors";
  if (/escapegames|arcades|axethrowing|teambuilding|amusementparks|trampoline/.test(aliases)) return "sports";
  return "arts";
}

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city");
  const query = request.nextUrl.searchParams.get("q");
  if (!city || !YELP_API_KEY) {
    return NextResponse.json({ events: [] });
  }

  const headers = {
    Authorization: `Bearer ${YELP_API_KEY}`,
    Accept: "application/json",
  };

  const termParam = query ? `&term=${encodeURIComponent(query)}` : "";

  // Match iOS app: 40km radius, best_match sort, fetch 20 to allow post-filtering
  const res = await fetch(
    `https://api.yelp.com/v3/businesses/search?location=${encodeURIComponent(city)}${query ? termParam : `&categories=${GROUP_CATEGORIES}`}&sort_by=best_match&radius=40000&limit=20`,
    { headers }
  );

  if (!res.ok) {
    return NextResponse.json({ events: [] });
  }

  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businesses: any[] = (data.businesses || [])
    // Post-filter: rating >= 3.0 and must not be permanently closed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((b: any) => (b.rating ?? 0) >= 3.0 && !b.is_closed)
    .slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events = businesses.map((b: any) => ({
    id: `yelp-${b.id}`,
    title: b.name,
    description: b.categories?.map((c: { title: string }) => c.title).join(", ") || "",
    category: b.categories ? mapCategory(b.categories) : "arts",
    image: b.image_url || null,
    source: "yelp",
    url: b.url || null,
    venue: {
      name: b.name,
      address: b.location?.display_address?.join(", ") || "",
    },
    suggestedDate: null,
    suggestedTime: null,
    capacityMin: null,
    capacityMax: null,
    suggestedDays: [],
    suggestedTimes: [],
  }));

  return NextResponse.json({ events });
}
