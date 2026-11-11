import { NextRequest, NextResponse } from "next/server";

// "Get tickets" on a plan made from a ticketed event: os.joinleaf.com/tickets/<plan>.
// Records the click (trackTicketClick) and sends the person on to the
// Ticketmaster / SeatGeek / Eventbrite / Luma page. Used by the web pages,
// the app, and reminder texts and emails, so every click counts the same way.
// If anything fails, the person lands on the plan page instead of an error.

const PARSE_APP_ID = process.env.NEXT_PUBLIC_PARSE_APP_ID || "";
const PARSE_JS_KEY = process.env.NEXT_PUBLIC_PARSE_JS_KEY || "";
const PARSE_SERVER_URL =
  process.env.NEXT_PUBLIC_PARSE_SERVER_URL || "https://ali.joinleaf.com/parse";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventGroupId: string }> },
) {
  const { eventGroupId } = await params;
  const surface = request.nextUrl.searchParams.get("s") || "other";
  const fallback = new URL(`/p/${encodeURIComponent(eventGroupId)}`, request.nextUrl.origin);
  if (!/^[A-Za-z0-9]{6,20}$/.test(eventGroupId) || !PARSE_APP_ID) {
    return NextResponse.redirect(fallback, 302);
  }
  try {
    const res = await fetch(`${PARSE_SERVER_URL}/functions/trackTicketClick`, {
      method: "POST",
      headers: {
        "X-Parse-Application-Id": PARSE_APP_ID,
        "X-Parse-Javascript-Key": PARSE_JS_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ eventGroupId, surface }),
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.redirect(fallback, 302);
    const data = (await res.json()) as { result?: { ticketUrl?: string } };
    const url = data.result?.ticketUrl;
    if (!url || !/^https?:\/\//i.test(url)) return NextResponse.redirect(fallback, 302);
    return NextResponse.redirect(url, 302);
  } catch {
    return NextResponse.redirect(fallback, 302);
  }
}
