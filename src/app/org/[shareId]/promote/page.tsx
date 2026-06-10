"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  Printer,
  Loader2,
  Megaphone,
  X,
  Sparkles,
} from "lucide-react";

interface CalendarInfo {
  objectId: string;
  shareId: string;
  name: string;
  ownerId: string | null;
  ownerName: string;
  city: string | null;
}

type Template = "door-hanger" | "lobby-flyer";

export default function PromotePage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = use(params);
  const [calendar, setCalendar] = useState<CalendarInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [template, setTemplate] = useState<Template>("door-hanger");
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const current = Parse.User.current();
        if (!current) {
          setError("Sign in to view promotion materials.");
          return;
        }
        const result = await Parse.Cloud.run("getCalendarByShareId", {
          shareId,
        });
        const cal = result.calendar || result;
        const ownerId =
          cal.owner?.objectId ||
          cal.owner?.id ||
          cal.ownerId ||
          null;
        const info: CalendarInfo = {
          objectId: cal.objectId || cal.id,
          shareId: cal.shareId,
          name: cal.name,
          ownerId,
          ownerName:
            cal.owner?.full_name || cal.owner?.name || cal.ownerName || "",
          city: cal.city || null,
        };
        const owns = !!ownerId && ownerId === current.id;
        setCalendar(info);
        setIsOwner(owns);

        if (owns) {
          const flagKey = `promote_seen_${shareId}`;
          if (!localStorage.getItem(flagKey)) {
            setShowWelcome(true);
            localStorage.setItem(flagKey, "1");
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load calendar");
      } finally {
        setLoading(false);
      }
    })();
  }, [shareId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error || !calendar) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold">Can&apos;t load this page</h1>
          <p className="mt-2 text-sm text-zinc-500">
            {error || "Calendar not found"}
          </p>
        </div>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold">Owner only</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Marketing materials are available to the calendar owner.
          </p>
          <Link
            href={`/org/${shareId}`}
            className="mt-4 inline-block text-sm text-emerald-700 underline"
          >
            View the calendar instead
          </Link>
        </div>
      </div>
    );
  }

  const calendarUrl = `https://www.os.joinleaf.com/org/${calendar.shareId}`;

  const handlePrint = () => window.print();

  return (
    <>
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-page {
            page-break-after: always;
            box-shadow: none !important;
            border: none !important;
          }
        }
        @page {
          margin: 0.4in;
        }
      `}</style>

      {showWelcome && (
        <WelcomePopup
          calendarName={calendar.name}
          onClose={() => setShowWelcome(false)}
        />
      )}

      <div className="min-h-screen bg-zinc-50">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 md:py-8 space-y-6">
          <div className="no-print">
            <Link
              href={`/dashboard/${calendar.objectId}?tab=calendars`}
              className="text-sm text-zinc-500 hover:text-zinc-900 inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
            </Link>

            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight inline-flex items-center gap-2">
                  <Megaphone className="w-6 h-6 text-emerald-700" />
                  Promote {calendar.name}
                </h1>
                <p className="text-sm text-zinc-500 mt-1">
                  Printable flyers and door hangers. Residents scan the QR to
                  join your calendar.
                </p>
              </div>
              <button
                onClick={handlePrint}
                className="inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium px-4 py-3 md:py-2 rounded-md"
              >
                <Printer className="w-4 h-4" />
                Print / Save as PDF
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              {(
                [
                  ["door-hanger", "Door hanger"],
                  ["lobby-flyer", "Lobby flyer"],
                ] as [Template, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setTemplate(k)}
                  className={`px-3 py-1.5 rounded-full text-xs ${
                    template === k
                      ? "bg-emerald-700 text-white"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              Tip: use your browser&apos;s print dialog → <em>Save as PDF</em> to
              download.
            </p>
          </div>

          <div className="flex justify-center">
            {template === "door-hanger" && (
              <DoorHanger calendar={calendar} url={calendarUrl} />
            )}
            {template === "lobby-flyer" && (
              <LobbyFlyer calendar={calendar} url={calendarUrl} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function WelcomePopup({
  calendarName,
  onClose,
}: {
  calendarName: string;
  onClose: () => void;
}) {
  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 px-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-900"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Spread the word</h2>
            <p className="text-sm text-zinc-600 mt-1">
              Print door hangers and flyers for {calendarName}. Residents scan
              the QR code and join your calendar in one tap — no app required.
            </p>
            <button
              onClick={onClose}
              className="mt-4 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium px-4 py-2 rounded-md"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DoorHanger({
  calendar,
  url,
}: {
  calendar: CalendarInfo;
  url: string;
}) {
  return (
    <div
      className="print-page bg-white shadow-md border border-zinc-200"
      style={{
        width: "4.25in",
        height: "11in",
        padding: "0.5in 0.4in",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-widest text-emerald-700 font-semibold">
          Leaf
        </div>
        <div className="mt-4 text-xl font-bold leading-tight">
          Meet your neighbors.
        </div>
        <div className="mt-1 text-xs text-zinc-600">
          Bowling. Pickleball. Happy hours. Dinners.
        </div>
      </div>

      <div className="mt-6 flex justify-center">
        <div className="border-2 border-zinc-900 p-2">
          <QRCodeSVG value={url} size={170} level="M" />
        </div>
      </div>

      <div className="mt-5 text-center">
        <div className="text-xs text-zinc-500">Scan to join</div>
        <div className="mt-1 text-base font-bold">{calendar.name}</div>
      </div>

      <div className="mt-auto pt-6 text-center text-[10px] text-zinc-400">
        <div>Free for residents · 30 seconds to set up</div>
        <div className="mt-1">No app required</div>
      </div>
    </div>
  );
}

function LobbyFlyer({
  calendar,
  url,
}: {
  calendar: CalendarInfo;
  url: string;
}) {
  return (
    <div
      className="print-page bg-white shadow-md border border-zinc-200"
      style={{
        width: "8.5in",
        height: "11in",
        padding: "0.6in 0.7in",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div>
        <div className="text-[10px] uppercase tracking-widest text-emerald-700 font-semibold">
          Leaf · Resident calendar
        </div>
        <h1 className="mt-2 text-4xl font-bold leading-tight">
          {calendar.name} has a calendar.
        </h1>
        <p className="mt-3 text-zinc-700 text-lg">
          A free shared calendar for residents to organize and RSVP to building
          events.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-3 text-sm">
        <SamplePlan
          title="Bowling Night"
          when="Fri 7:30 PM"
          where="Frames Bowling"
        />
        <SamplePlan
          title="Pickleball Pickup"
          when="Sat 6:00 PM"
          where="Lincoln Park Courts"
        />
        <SamplePlan
          title="Rooftop Mixer"
          when="Sun 6:30 PM"
          where="Building Rooftop"
        />
      </div>

      <div className="mt-auto pt-8 flex items-end justify-between border-t border-zinc-200">
        <div className="pt-6">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Scan to join
          </div>
          <div className="mt-1 text-2xl font-bold">{calendar.name}</div>
          <div className="mt-1 text-xs text-zinc-500 break-all">{url}</div>
        </div>
        <div className="border-2 border-zinc-900 p-2">
          <QRCodeSVG value={url} size={150} level="M" />
        </div>
      </div>
    </div>
  );
}

function SamplePlan({
  title,
  when,
  where,
}: {
  title: string;
  when: string;
  where: string;
}) {
  return (
    <div className="border border-zinc-200 rounded p-3">
      <div className="font-semibold">{title}</div>
      <div className="text-xs text-zinc-500 mt-0.5">{when}</div>
      <div className="text-xs text-zinc-500">{where}</div>
    </div>
  );
}
