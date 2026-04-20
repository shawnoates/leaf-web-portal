import { NextRequest, NextResponse } from "next/server";

const YELP_API_KEY = process.env.YELP_API_KEY || "";

// Map Yelp categories to app categories
function mapCategory(categories: { alias: string; title: string }[]): string {
  const aliases = categories.map((c) => c.alias).join(",");
  if (/restaurant|food|dining|brunch|breakfast|lunch|dinner|cafe|coffee/.test(aliases)) return "dining";
  if (/sport|gym|fitness|recreation/.test(aliases)) return "sports";
  if (/music|concert|dj|karaoke/.test(aliases)) return "music";
  if (/art|gallery|museum|theater|theatre|film/.test(aliases)) return "arts";
  if (/nightlife|bar|pub|club|lounge|brewery/.test(aliases)) return "nightlife";
  if (/park|hik|outdoor|garden|beach|nature|camping/.test(aliases)) return "outdoors";
  return "dining"; // default
}

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city");
  if (!city || !YELP_API_KEY) {
    return NextResponse.json({ events: [], trendingVenues: [] });
  }

  const headers = { Authorization: `Bearer ${YELP_API_KEY}` };

  // Fetch events and trending businesses in parallel
  const [eventsRes, venuesRes] = await Promise.allSettled([
    fetch(
      `https://api.yelp.com/v3/events?location=${encodeURIComponent(city)}&limit=10&sort_on=popularity`,
      { headers }
    ),
    fetch(
      `https://api.yelp.com/v3/businesses/search?location=${encodeURIComponent(city)}&sort_by=rating&limit=10&categories=restaurants,nightlife,arts,fitness`,
      { headers }
    ),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let events: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let venues: any[] = [];

  if (eventsRes.status === "fulfilled" && eventsRes.value.ok) {
    const data = await eventsRes.value.json();
    events = data.events || [];
  }

  if (venuesRes.status === "fulfilled" && venuesRes.value.ok) {
    const data = await venuesRes.value.json();
    venues = data.businesses || [];
  }

  // Map Yelp events to MarketplaceEvent format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mappedEvents = events.map((e: any) => ({
    id: `yelp-${e.id}`,
    title: e.name,
    description: e.description || "",
    category: e.category ? mapCategoryString(e.category) : "dining",
    image: e.image_url || null,
    source: "yelp",
    url: e.event_site_url || null,
    venue: e.location
      ? { name: e.business_id || "Venue", address: e.location.display_address?.join(", ") || "" }
      : null,
    suggestedDate: e.time_start ? e.time_start.split("T")[0] : null,
    suggestedTime: e.time_start ? formatTime(e.time_start) : null,
    capacityMin: null,
    capacityMax: e.attending_count || null,
    suggestedDays: [],
    suggestedTimes: e.time_start ? [getTimeOfDay(e.time_start)] : [],
  }));

  // Map Yelp businesses to trending venue MarketplaceEvents
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trendingVenues = venues.map((v: any) => ({
    id: `yelp-venue-${v.id}`,
    title: v.name,
    description: v.categories?.map((c: { title: string }) => c.title).join(", ") || "",
    category: v.categories ? mapCategory(v.categories) : "dining",
    image: v.image_url || null,
    source: "yelp_venue",
    url: v.url || null,
    venue: {
      name: v.name,
      address: v.location?.display_address?.join(", ") || "",
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

function mapCategoryString(category: string): string {
  const lower = category.toLowerCase();
  if (/food|dining|restaurant/.test(lower)) return "dining";
  if (/sport|fitness/.test(lower)) return "sports";
  if (/music|concert/.test(lower)) return "music";
  if (/art|film|visual/.test(lower)) return "arts";
  if (/nightlife|social/.test(lower)) return "nightlife";
  if (/outdoor|nature/.test(lower)) return "outdoors";
  return "dining";
}

function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch {
    return "";
  }
}

function getTimeOfDay(isoString: string): string {
  try {
    const hour = new Date(isoString).getHours();
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    if (hour < 21) return "evening";
    return "night";
  } catch {
    return "evening";
  }
}
