import { NextRequest, NextResponse } from "next/server";

const STUBHUB_CLIENT_ID = process.env.STUBHUB_CLIENT_ID || "";
const STUBHUB_CLIENT_SECRET = process.env.STUBHUB_CLIENT_SECRET || "";

// In-memory token cache (lasts 24h per StubHub docs)
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const credentials = Buffer.from(
    `${encodeURIComponent(STUBHUB_CLIENT_ID)}:${encodeURIComponent(STUBHUB_CLIENT_SECRET)}`
  ).toString("base64");

  try {
    const res = await fetch("https://account.stubhub.com/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials&scope=read:events",
    });

    if (!res.ok) return null;

    const data = await res.json();
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000, // refresh 1min early
    };
    return cachedToken.token;
  } catch {
    return null;
  }
}

// Map StubHub categories to app categories
function mapCategory(genre: string): string {
  const lower = (genre || "").toLowerCase();
  if (/sport|basketball|football|baseball|hockey|soccer|tennis|golf|racing|mma|boxing/.test(lower)) return "sports";
  if (/concert|music|festival|dj|rock|pop|hip.?hop|jazz|country/.test(lower)) return "music";
  if (/theater|theatre|broadway|comedy|dance|opera|circus|performing/.test(lower)) return "arts";
  if (/club|party/.test(lower)) return "nightlife";
  return "music";
}

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city");
  if (!city || !STUBHUB_CLIENT_ID || !STUBHUB_CLIENT_SECRET) {
    return NextResponse.json({ events: [] });
  }

  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ events: [] });
  }

  try {
    const res = await fetch(
      `https://api.stubhub.net/catalog/events/search?q=${encodeURIComponent(city)}&page_size=10&exclude_parking_passes=true`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ events: [] });
    }

    const data = await res.json();
    const rawEvents = data.items || data.events || data._embedded?.items || [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events = rawEvents.map((e: any) => {
      const dateStr = e.start_date || e.event_date || null;
      const venueName = e.venue?.name || "";
      const venueCity = e.venue?.city || "";
      const venueState = e.venue?.state_province || "";
      const venueAddress = [venueName, venueCity, venueState].filter(Boolean).join(", ");

      return {
        id: `stubhub-${e.id}`,
        title: e.name || "",
        description: e.note || e.name || "",
        category: mapCategory(e.genre?.name || e.category?.name || ""),
        image: e.image_url || e.images?.[0]?.url || null,
        source: "stubhub",
        url: e.url || (e.id ? `https://www.stubhub.com/event/${e.id}` : null),
        venue: venueName
          ? { name: venueName, address: [venueCity, venueState].filter(Boolean).join(", ") }
          : null,
        suggestedDate: dateStr ? dateStr.split("T")[0] : null,
        suggestedTime: dateStr ? formatTime(dateStr) : null,
        capacityMin: null,
        capacityMax: null,
        suggestedDays: dateStr ? [getDayName(dateStr)] : [],
        suggestedTimes: dateStr ? [getTimeOfDay(dateStr)] : [],
      };
    });

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
