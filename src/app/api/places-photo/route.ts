import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

// In-memory cache to avoid repeated lookups for the same venue
const photoCache = new Map<string, { url: string | null; ts: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query");
  if (!query || !API_KEY) {
    return NextResponse.json({ url: null });
  }

  // Check cache
  const cacheKey = query.toLowerCase().trim();
  const cached = photoCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ url: cached.url });
  }

  try {
    // Use Find Place to get photo_reference
    const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=photos&key=${API_KEY}`;
    const findRes = await fetch(findUrl);
    const findData = await findRes.json();

    const photoRef = findData.candidates?.[0]?.photos?.[0]?.photo_reference;
    if (!photoRef) {
      photoCache.set(cacheKey, { url: null, ts: Date.now() });
      return NextResponse.json({ url: null });
    }

    // Construct the photo URL (Google will redirect to the actual image)
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoRef}&key=${API_KEY}`;

    photoCache.set(cacheKey, { url: photoUrl, ts: Date.now() });
    return NextResponse.json({ url: photoUrl });
  } catch (err) {
    console.error("[/api/places-photo] error:", err);
    return NextResponse.json({ url: null });
  }
}
