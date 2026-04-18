import { NextRequest, NextResponse } from "next/server";

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || "";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query");
  if (!query || !UNSPLASH_ACCESS_KEY) {
    return NextResponse.json({ results: [] });
  }

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=4&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } }
    );
    if (!res.ok) return NextResponse.json({ results: [] });

    const data = await res.json();
    // Return only the fields the client needs
    const results = (data.results || []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (photo: any) => ({
        id: photo.id,
        url: photo.urls.regular,
        thumbUrl: photo.urls.small,
        alt: photo.alt_description || "",
        photographerName: photo.user.name,
        photographerUrl: photo.user.links.html,
      })
    );
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
