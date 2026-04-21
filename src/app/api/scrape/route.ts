import { NextRequest, NextResponse } from "next/server";

const PARSE_APP_ID = process.env.NEXT_PUBLIC_PARSE_APP_ID || "";
const PARSE_JS_KEY = process.env.NEXT_PUBLIC_PARSE_JS_KEY || "";
const PARSE_SERVER_URL =
  process.env.NEXT_PUBLIC_PARSE_SERVER_URL || "https://ali.joinleaf.com/parse";

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city");
  if (!city || !PARSE_APP_ID) {
    return NextResponse.json({ events: [] });
  }

  // Match the base city name (before the comma), same logic as getScrapedEvents cloud function
  const baseName = city.split(",")[0].trim();

  const res = await fetch(
    `${PARSE_SERVER_URL}/classes/ScrapedEvent?${new URLSearchParams({
      where: JSON.stringify({ cityName: { $regex: `^${baseName}` } }),
      limit: "20",
      order: "-createdAt",
    })}`,
    {
      headers: {
        "X-Parse-Application-Id": PARSE_APP_ID,
        "X-Parse-Javascript-Key": PARSE_JS_KEY,
      },
    }
  );

  if (!res.ok) {
    return NextResponse.json({ events: [] });
  }

  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events = (data.results || []).map((e: any) => ({
    id: `scrape-${e.objectId}`,
    title: e.name || "Untitled",
    description: e.eventDescription || "",
    category: e.categoryId || "arts",
    image: e.imageURL || null,
    source: "firecrawl",
    url: e.eventURL || null,
    venue:
      e.venue || e.formattedAddress
        ? {
            name: e.venue || "",
            address: e.formattedAddress || "",
          }
        : null,
    suggestedDate: e.date || null,
    suggestedTime: e.time || null,
    capacityMin: null,
    capacityMax: null,
    suggestedDays: [],
    suggestedTimes: [],
  }));

  return NextResponse.json({ events });
}
