import { NextRequest, NextResponse } from "next/server";

const YELP_API_KEY = process.env.YELP_API_KEY || "";

// Map Yelp categories to app categories
function mapCategory(categories: { alias: string; title: string }[]): string {
  const aliases = categories.map((c) => c.alias).join(",");
  if (/restaurant|food|dining|brunch|breakfast|lunch|dinner|cafe|coffee|bakeries|pizza|sushi|mexican|italian|chinese|thai/.test(aliases)) return "dining";
  if (/sport|gym|fitness|recreation|stadiums|basketball|soccer/.test(aliases)) return "sports";
  if (/music|concert|dj|karaoke|musicvenues|jazz/.test(aliases)) return "music";
  if (/art|gallery|museum|theater|theatre|film|cinema|performing/.test(aliases)) return "arts";
  if (/nightlife|bar|pub|club|lounge|brewery|wine_bars|cocktailbars/.test(aliases)) return "nightlife";
  if (/park|hik|outdoor|garden|beach|nature|camping|playground/.test(aliases)) return "outdoors";
  return "dining";
}

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city");
  if (!city || !YELP_API_KEY) {
    return NextResponse.json({ events: [], trendingVenues: [], debug: { hasKey: !!YELP_API_KEY, city } });
  }

  const headers = {
    Authorization: `Bearer ${YELP_API_KEY}`,
    Accept: "application/json",
  };

  // Fetch popular activities/entertainment AND trending restaurants/venues in parallel
  const [activitiesRes, venuesRes] = await Promise.allSettled([
    fetch(
      `https://api.yelp.com/v3/businesses/search?location=${encodeURIComponent(city)}&categories=arts,musicvenues,fitness,nightlife,active&sort_by=rating&limit=10`,
      { headers }
    ),
    fetch(
      `https://api.yelp.com/v3/businesses/search?location=${encodeURIComponent(city)}&categories=restaurants,bars,cafes&sort_by=rating&limit=10`,
      { headers }
    ),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let activities: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let venues: any[] = [];

  if (activitiesRes.status === "fulfilled" && activitiesRes.value.ok) {
    const data = await activitiesRes.value.json();
    activities = data.businesses || [];
  }

  if (venuesRes.status === "fulfilled" && venuesRes.value.ok) {
    const data = await venuesRes.value.json();
    venues = data.businesses || [];
  }

  // Map activities to MarketplaceEvent format (these are "events" you can plan)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mappedEvents = activities.map((b: any) => ({
    id: `yelp-${b.id}`,
    title: b.name,
    description: b.categories?.map((c: { title: string }) => c.title).join(", ") || "",
    category: b.categories ? mapCategory(b.categories) : "dining",
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

  // Map top restaurants/bars as trending venues
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trendingVenues = venues.map((b: any) => ({
    id: `yelp-venue-${b.id}`,
    title: b.name,
    description: b.categories?.map((c: { title: string }) => c.title).join(", ") || "",
    category: b.categories ? mapCategory(b.categories) : "dining",
    image: b.image_url || null,
    source: "yelp_venue",
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

  return NextResponse.json({ events: mappedEvents, trendingVenues });
}
