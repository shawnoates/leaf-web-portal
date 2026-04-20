import { NextRequest, NextResponse } from "next/server";

const TICKETMASTER_API_KEY = process.env.TICKETMASTER_API_KEY || "";

// Map Ticketmaster segment/genre to app categories
function mapCategory(segment: string, genre?: string): string {
  const seg = (segment || "").toLowerCase();
  const gen = (genre || "").toLowerCase();
  if (/sport/.test(seg)) return "sports";
  if (/music/.test(seg)) return "music";
  if (/art|theatre|theater|comedy|film/.test(seg) || /art|theatre|theater/.test(gen)) return "arts";
  if (/nightlife|club/.test(gen)) return "nightlife";
  if (/outdoor|nature/.test(gen)) return "outdoors";
  if (/food|dining/.test(gen)) return "dining";
  return "music"; // most Ticketmaster events are entertainment
}

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city");
  const query = request.nextUrl.searchParams.get("q");
  if (!city || !TICKETMASTER_API_KEY) {
    return NextResponse.json({ events: [] });
  }

  try {
    const keywordParam = query ? `&keyword=${encodeURIComponent(query)}` : "";
    const res = await fetch(
      `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TICKETMASTER_API_KEY}&city=${encodeURIComponent(city)}&size=10&sort=relevance,desc${keywordParam}`,
      { headers: { Accept: "application/json" } }
    );

    if (!res.ok) {
      return NextResponse.json({ events: [] });
    }

    const data = await res.json();
    const rawEvents = data._embedded?.events || [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events = rawEvents.map((e: any) => {
      const venue = e._embedded?.venues?.[0];
      const segment = e.classifications?.[0]?.segment?.name || "";
      const genre = e.classifications?.[0]?.genre?.name || "";
      const bestImage = e.images?.find((img: { width: number }) => img.width >= 500) || e.images?.[0];
      const dateStr = e.dates?.start?.localDate || null;
      const timeStr = e.dates?.start?.localTime || null;

      return {
        id: `tm-${e.id}`,
        title: e.name || "",
        description: e.info || e.pleaseNote || `${segment} ${genre ? `· ${genre}` : ""}`.trim(),
        category: mapCategory(segment, genre),
        image: bestImage?.url || null,
        source: "ticketmaster_direct",
        url: e.url || null,
        venue: venue
          ? {
              name: venue.name || "",
              address: [venue.address?.line1, venue.city?.name, venue.state?.stateCode]
                .filter(Boolean)
                .join(", "),
            }
          : null,
        suggestedDate: dateStr,
        suggestedTime: timeStr ? formatTime(timeStr) : null,
        capacityMin: null,
        capacityMax: null,
        suggestedDays: dateStr ? [getDayName(dateStr)] : [],
        suggestedTimes: timeStr ? [getTimeOfDay(timeStr)] : [],
      };
    });

    return NextResponse.json({ events });
  } catch {
    return NextResponse.json({ events: [] });
  }
}

function formatTime(time: string): string {
  try {
    // time comes as "HH:mm:ss"
    const [h, m] = time.split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${m} ${ampm}`;
  } catch {
    return "";
  }
}

function getDayName(dateStr: string): string {
  try {
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString("en-US", { weekday: "long" });
  } catch {
    return "";
  }
}

function getTimeOfDay(time: string): string {
  try {
    const hour = parseInt(time.split(":")[0], 10);
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    if (hour < 21) return "evening";
    return "night";
  } catch {
    return "evening";
  }
}
