import { NextRequest } from "next/server";

// We emit DTSTART/DTEND as **floating time** (no `Z`, no `TZID`) so the
// calendar app interprets the value as the importer's local time. Mirrors
// the timezone reasoning in src/app/org/[shareId]/page.tsx — see comments
// there for the legacy "naive UTC" plans this works around.
//
// Served from a real HTTP endpoint (not a `data:` URL) so iOS Safari opens
// the Calendar "add event" sheet directly. `data:text/calendar` would
// download/preview instead.

function parseTime(s: string): { h: number; m: number } | null {
  const t = s.trim();
  const ampm = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = ampm[2] ? parseInt(ampm[2], 10) : 0;
    const isPM = ampm[3].toUpperCase() === "PM";
    if (isPM && h < 12) h += 12;
    if (!isPM && h === 12) h = 0;
    return { h, m };
  }
  const h24 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) return { h: parseInt(h24[1], 10), m: parseInt(h24[2], 10) };
  return null;
}

function buildIcs(opts: {
  uid: string;
  title: string;
  dateISO: string;
  time?: string | null;
  durationHours?: number;
  description?: string;
  locationName?: string | null;
  locationAddress?: string | null;
  url?: string;
}): string | null {
  const seed = new Date(opts.dateISO);
  if (Number.isNaN(seed.getTime())) return null;

  const pad = (n: number) => String(n).padStart(2, "0");
  const floatFmt = (y: number, mo: number, d: number, h: number, mi: number) =>
    `${y}${pad(mo)}${pad(d)}T${pad(h)}${pad(mi)}00`;
  const utcFmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const year = seed.getFullYear();
  const month = seed.getMonth() + 1;
  const day = seed.getDate();

  const parsed = opts.time ? parseTime(opts.time) : null;
  const startHour = parsed ? parsed.h : seed.getHours();
  const startMin = parsed ? parsed.m : seed.getMinutes();

  const startLocal = new Date(year, month - 1, day, startHour, startMin, 0, 0);
  const endLocal = new Date(startLocal.getTime() + (opts.durationHours ?? 2) * 60 * 60 * 1000);

  const dtStart = floatFmt(year, month, day, startHour, startMin);
  const dtEnd = floatFmt(
    endLocal.getFullYear(),
    endLocal.getMonth() + 1,
    endLocal.getDate(),
    endLocal.getHours(),
    endLocal.getMinutes(),
  );

  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

  const locationParts = [opts.locationName, opts.locationAddress].filter(Boolean) as string[];
  const location = locationParts.join(", ");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Leaf//Calendar Plan//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${opts.uid}@joinleaf.com`,
    `DTSTAMP:${utcFmt(new Date())}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${esc(opts.title)}`,
    opts.description ? `DESCRIPTION:${esc(opts.description)}` : "",
    location ? `LOCATION:${esc(location)}` : "",
    opts.url ? `URL:${esc(opts.url)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return lines.join("\r\n");
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const uid = sp.get("uid");
  const title = sp.get("title");
  const dateISO = sp.get("dateISO");
  if (!uid || !title || !dateISO) {
    return new Response("missing required params", { status: 400 });
  }

  const durationParam = sp.get("durationHours");
  const ics = buildIcs({
    uid,
    title,
    dateISO,
    time: sp.get("time"),
    durationHours: durationParam ? Number(durationParam) : undefined,
    description: sp.get("description") ?? undefined,
    locationName: sp.get("locationName"),
    locationAddress: sp.get("locationAddress"),
    url: sp.get("url") ?? undefined,
  });

  if (!ics) return new Response("invalid date", { status: 400 });

  return new Response(ics, {
    headers: {
      // `inline` (not `attachment`) is what gets iOS Safari to open the
      // Calendar "add event" sheet instead of downloading the file.
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="event.ics"',
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
