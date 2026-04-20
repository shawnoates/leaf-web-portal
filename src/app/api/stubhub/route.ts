import { NextRequest, NextResponse } from "next/server";

const STUBHUB_API_KEY = process.env.STUBHUB_API_KEY || "";

// Map StubHub categories to app categories
function mapCategory(categoryName: string): string {
  const lower = (categoryName || "").toLowerCase();
  if (/sport|basketball|football|baseball|hockey|soccer|tennis|golf|racing/.test(lower)) return "sports";
  if (/concert|music|festival|dj/.test(lower)) return "music";
  if (/theater|theatre|broadway|comedy|dance|opera|circus/.test(lower)) return "arts";
  if (/club|party/.test(lower)) return "nightlife";
  return "music"; // most StubHub events are ticketed entertainment
}

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city");
  if (!city || !STUBHUB_API_KEY) {
    return NextResponse.json({ events: [] });
  }

  try {
    const res = await fetch(
      `https://api.stubhub.com/sellers/search/events/v3?city=${encodeURIComponent(city)}&rows=10&sort=popularity+desc&status=active`,
      {
        headers: {
          Authorization: `Bearer ${STUBHUB_API_KEY}`,
          Accept: "application/json",
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ events: [] });
    }

    const data = await res.json();
    const rawEvents = data.events || data.numFound ? (data.events || []) : [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events = rawEvents.map((e: any) => ({
      id: `stubhub-${e.id || e.eventId}`,
      title: e.name || e.title || "",
      description: e.description || e.name || "",
      category: mapCategory(e.categoryName || e.groupingsName || ""),
      image: e.imageUrl || e.images?.[0]?.url || null,
      source: "stubhub",
      url: e.webURI ? `https://www.stubhub.com${e.webURI}` : null,
      venue: e.venue
        ? {
            name: e.venue.name || "",
            address: [e.venue.address1, e.venue.city, e.venue.state].filter(Boolean).join(", "),
          }
        : null,
      suggestedDate: e.eventDateLocal ? e.eventDateLocal.split("T")[0] : null,
      suggestedTime: e.eventDateLocal ? formatTime(e.eventDateLocal) : null,
      capacityMin: e.ticketInfo?.minPrice ? null : null,
      capacityMax: null,
      suggestedDays: e.eventDateLocal ? [getDayName(e.eventDateLocal)] : [],
      suggestedTimes: e.eventDateLocal ? [getTimeOfDay(e.eventDateLocal)] : [],
    }));

    return NextResponse.json({ events });
  } catch {
    return NextResponse.json({ events: [] });
  }
}

function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch {
    return "";
  }
}

function getDayName(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { weekday: "long" });
  } catch {
    return "";
  }
}

function getTimeOfDay(dateStr: string): string {
  try {
    const hour = new Date(dateStr).getHours();
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    if (hour < 21) return "evening";
    return "night";
  } catch {
    return "evening";
  }
}
