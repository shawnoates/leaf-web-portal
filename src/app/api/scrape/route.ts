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

  // Call the existing getScrapedEvents cloud function (uses masterKey server-side)
  const res = await fetch(`${PARSE_SERVER_URL}/functions/getScrapedEvents`, {
    method: "POST",
    headers: {
      "X-Parse-Application-Id": PARSE_APP_ID,
      "X-Parse-Javascript-Key": PARSE_JS_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cityName: city, limit: 20 }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[/api/scrape] Parse error:", res.status, text);
    return NextResponse.json({ events: [] });
  }

  const data = await res.json();
  const results = data.result || [];
  console.log(`[/api/scrape] city="${city}" → ${results.length} scraped events`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events = results.map((e: any) => ({
    id: `scrape-${e.id}`,
    title: e.name || "Untitled",
    description: e.description || "",
    category: e.categoryId || "arts",
    image: e.imageURL || null,
    source: "firecrawl",
    url: e.eventURL || null,
    venue: e.venue
      ? { name: e.name || "", address: e.venue }
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
