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
  orgType: string | null;
}

type Template = "flyer" | "social";

// ────────────────────────────────────────────────────────────────────────────
// Headline + sample-plan copy per orgType. The promote page picks the
// right variant based on the calendar's category so the hero text feels
// native to the audience.
// ────────────────────────────────────────────────────────────────────────────

interface CategoryConfig {
  headline: string; // hero on flyer/social
  subhead: (name: string) => string;
  plansLabel: string;
  plans: { emoji: string; title: string; when: string; where: string }[];
}

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  apartment_complex: {
    headline: "Meet your neighbors.",
    subhead: (name) =>
      `${name} has a shared calendar for residents to organize and RSVP to building events.`,
    plansLabel: "What residents organize",
    plans: [
      { emoji: "🎳", title: "Bowling Night", when: "Fri 7:30 PM", where: "Frames Lanes" },
      { emoji: "🥒", title: "Pickleball", when: "Sat 6:00 PM", where: "Lincoln Park" },
      { emoji: "🍷", title: "Rooftop Mixer", when: "Sun 6:30 PM", where: "Building Rooftop" },
    ],
  },
  community: {
    headline: "Meet your community.",
    subhead: (name) =>
      `${name} is a shared calendar for members to organize and RSVP to community events.`,
    plansLabel: "What members organize",
    plans: [
      { emoji: "☕", title: "Coffee Meetup", when: "Sat 10:00 AM", where: "Local Café" },
      { emoji: "🥾", title: "Group Hike", when: "Sun 8:00 AM", where: "Trailhead" },
      { emoji: "🎲", title: "Game Night", when: "Fri 7:00 PM", where: "Community Room" },
    ],
  },
  gym: {
    headline: "Meet your gym crew.",
    subhead: (name) =>
      `${name} is a shared calendar for members to organize workouts, classes, and gatherings.`,
    plansLabel: "What members organize",
    plans: [
      { emoji: "💪", title: "Group Lift", when: "Tue 6:00 AM", where: "Main Floor" },
      { emoji: "☀️", title: "Morning Yoga", when: "Sat 8:00 AM", where: "Studio" },
      { emoji: "🏃", title: "Run Club", when: "Sun 7:00 AM", where: "Park Loop" },
    ],
  },
  church: {
    headline: "Meet the congregation.",
    subhead: (name) =>
      `${name} is a shared calendar for the congregation to organize gatherings, studies, and events.`,
    plansLabel: "What members organize",
    plans: [
      { emoji: "📖", title: "Bible Study", when: "Wed 7:00 PM", where: "Fellowship Hall" },
      { emoji: "🍲", title: "Potluck", when: "Sun 12:30 PM", where: "Church Hall" },
      { emoji: "🎵", title: "Choir Practice", when: "Thu 6:30 PM", where: "Sanctuary" },
    ],
  },
  school: {
    headline: "Meet your classmates.",
    subhead: (name) =>
      `${name} is a shared calendar for students to organize meetups, study sessions, and events.`,
    plansLabel: "What students organize",
    plans: [
      { emoji: "📚", title: "Study Group", when: "Tue 6:00 PM", where: "Library Rm 2" },
      { emoji: "🏀", title: "Pickup Game", when: "Sat 2:00 PM", where: "Campus Gym" },
      { emoji: "🎬", title: "Movie Night", when: "Fri 8:00 PM", where: "Student Lounge" },
    ],
  },
  company: {
    headline: "Meet your coworkers.",
    subhead: (name) =>
      `${name} is a shared calendar for the team to organize gatherings, lunches, and events.`,
    plansLabel: "What teammates organize",
    plans: [
      { emoji: "🍱", title: "Team Lunch", when: "Thu 12:30 PM", where: "Conference Rm" },
      { emoji: "🍻", title: "Happy Hour", when: "Fri 5:30 PM", where: "Local Bar" },
      { emoji: "🎤", title: "Lunch & Learn", when: "Wed 12:00 PM", where: "Main Floor" },
    ],
  },
  brick_and_mortar: {
    headline: "Meet other regulars.",
    subhead: (name) =>
      `${name} is a shared calendar for regulars to organize meetups and events.`,
    plansLabel: "What regulars organize",
    plans: [
      { emoji: "☕", title: "Coffee Meetup", when: "Sat 10:00 AM", where: "Shop" },
      { emoji: "🎤", title: "Open Mic", when: "Fri 7:00 PM", where: "Stage" },
      { emoji: "🎲", title: "Game Night", when: "Wed 6:30 PM", where: "Back Room" },
    ],
  },
  consumer_brand: {
    headline: "Meet other fans.",
    subhead: (name) =>
      `${name} is a shared calendar for fans to organize meetups and events.`,
    plansLabel: "What fans organize",
    plans: [
      { emoji: "🎉", title: "Launch Party", when: "Sat 7:00 PM", where: "Venue TBD" },
      { emoji: "🤝", title: "Community Mixer", when: "Fri 6:00 PM", where: "Local Spot" },
      { emoji: "🛠️", title: "Workshop", when: "Sun 1:00 PM", where: "Studio" },
    ],
  },
  other: {
    headline: "Meet the group.",
    subhead: (name) =>
      `${name} is a shared calendar for members to organize and RSVP to events.`,
    plansLabel: "What members organize",
    plans: [
      { emoji: "☕", title: "Coffee Meetup", when: "Sat 10:00 AM", where: "Local Café" },
      { emoji: "🍽️", title: "Dinner", when: "Fri 7:00 PM", where: "Restaurant" },
      { emoji: "🎲", title: "Game Night", when: "Wed 7:00 PM", where: "Hangout Spot" },
    ],
  },
};

function getCategoryConfig(orgType: string | null): CategoryConfig {
  if (orgType && CATEGORY_CONFIG[orgType]) return CATEGORY_CONFIG[orgType];
  return CATEGORY_CONFIG.other;
}

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
  const [template, setTemplate] = useState<Template>("flyer");
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
          orgType: cal.orgType || cal.org_type || null,
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
                  Print, save, or share. Residents scan the QR to join.
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
                  ["flyer", "Flyer"],
                  ["social", "Social media"],
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
              {template === "flyer"
                ? "Letter size · prints on standard 8.5\" × 11\" paper."
                : "1080 × 1080 — sized for Instagram, Facebook, Threads."}
            </p>
          </div>

          <div className="flex justify-center">
            {template === "flyer" && (
              <Flyer calendar={calendar} url={calendarUrl} />
            )}
            {template === "social" && (
              <SocialPost calendar={calendar} url={calendarUrl} />
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
              Print a flyer for {calendarName} or post to social. Residents scan
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

// ────────────────────────────────────────────────────────────────────────────
// FLYER — letter size, bold design
// ────────────────────────────────────────────────────────────────────────────

function Flyer({
  calendar,
  url,
}: {
  calendar: CalendarInfo;
  url: string;
}) {
  const config = getCategoryConfig(calendar.orgType);
  return (
    <div
      className="print-page bg-white shadow-md border border-zinc-200 overflow-hidden"
      style={{
        width: "8.5in",
        height: "11in",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top color band */}
      <div
        style={{
          background:
            "linear-gradient(135deg, #064e3b 0%, #047857 50%, #10b981 100%)",
          padding: "0.75in 0.7in 0.6in",
          color: "white",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            fontWeight: 600,
            opacity: 0.85,
          }}
        >
          Leaf · Shared calendar
        </div>
        <h1
          style={{
            fontSize: "68px",
            fontWeight: 800,
            lineHeight: 1.0,
            marginTop: "18px",
            letterSpacing: "-0.025em",
          }}
        >
          {config.headline}
        </h1>
        <p
          style={{
            marginTop: "16px",
            fontSize: "20px",
            fontWeight: 300,
            opacity: 0.95,
            maxWidth: "6in",
            lineHeight: 1.35,
          }}
        >
          {config.subhead(calendar.name)}
        </p>
      </div>

      {/* QR section — center stage, lots of breathing room */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0.6in 0.7in",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: "#047857",
            marginBottom: "20px",
          }}
        >
          Scan to join · 30 seconds
        </div>
        <div
          style={{
            background: "white",
            border: "3px solid #064e3b",
            padding: "16px",
            borderRadius: "8px",
          }}
        >
          <QRCodeSVG value={url} size={260} level="M" />
        </div>
        <div
          style={{
            fontSize: "38px",
            fontWeight: 800,
            marginTop: "28px",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            textAlign: "center",
            maxWidth: "6.5in",
          }}
        >
          {calendar.name}
        </div>
        <div
          style={{
            fontSize: "13px",
            color: "#71717a",
            marginTop: "12px",
            wordBreak: "break-all",
            textAlign: "center",
          }}
        >
          {url}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "0.3in 0.7in 0.45in",
          borderTop: "1px solid #f4f4f5",
          fontSize: "11px",
          color: "#a1a1aa",
          textAlign: "center",
          letterSpacing: "0.05em",
        }}
      >
        Free · No app required · Powered by Leaf
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SOCIAL POST — 1080×1080 (rendered at smaller size on screen, prints square)
// ────────────────────────────────────────────────────────────────────────────

function SocialPost({
  calendar,
  url,
}: {
  calendar: CalendarInfo;
  url: string;
}) {
  const config = getCategoryConfig(calendar.orgType);
  // For visual impact on social, split the headline into two lines at the
  // first space (e.g., "Meet your neighbors." → "Meet your\nneighbors.").
  const headlineWords = config.headline.split(" ");
  const splitIdx = Math.ceil(headlineWords.length / 2);
  const headlineL1 = headlineWords.slice(0, splitIdx).join(" ");
  const headlineL2 = headlineWords.slice(splitIdx).join(" ");
  return (
    <div
      className="print-page shadow-md overflow-hidden"
      style={{
        width: "1080px",
        height: "1080px",
        maxWidth: "100%",
        aspectRatio: "1 / 1",
        position: "relative",
        background:
          "linear-gradient(135deg, #022c22 0%, #064e3b 40%, #047857 100%)",
        color: "white",
        display: "flex",
        flexDirection: "column",
        // Scale down to fit screen while preserving 1080×1080 print size
        transform: "scale(min(1, calc((100vw - 32px) / 1080)))",
        transformOrigin: "top center",
      }}
    >
      {/* Decorative texture circles */}
      <div
        style={{
          position: "absolute",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.04)",
          top: "-200px",
          right: "-150px",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "400px",
          height: "400px",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.03)",
          bottom: "-100px",
          left: "-100px",
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          padding: "80px",
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        <div
          style={{
            fontSize: "20px",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            fontWeight: 600,
            opacity: 0.85,
          }}
        >
          Leaf · Shared calendar
        </div>

        <div style={{ marginTop: "40px", flex: 1 }}>
          <h1
            style={{
              fontSize: "104px",
              fontWeight: 900,
              lineHeight: 0.95,
              letterSpacing: "-0.03em",
            }}
          >
            {headlineL1}
            {headlineL2 && (
              <>
                <br />
                {headlineL2}
              </>
            )}
          </h1>
          <p
            style={{
              marginTop: "32px",
              fontSize: "30px",
              fontWeight: 300,
              opacity: 0.9,
              maxWidth: "780px",
              lineHeight: 1.3,
            }}
          >
            {config.subhead(calendar.name)}
          </p>
        </div>

        {/* Footer: QR + CTA */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "40px",
            paddingTop: "32px",
            borderTop: "1px solid rgba(255,255,255,0.2)",
          }}
        >
          <div
            style={{
              background: "white",
              padding: "14px",
              borderRadius: "12px",
            }}
          >
            <QRCodeSVG value={url} size={180} level="M" fgColor="#022c22" />
          </div>
          <div>
            <div
              style={{
                fontSize: "16px",
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                fontWeight: 700,
                opacity: 0.85,
              }}
            >
              Scan to join
            </div>
            <div
              style={{
                fontSize: "44px",
                fontWeight: 800,
                marginTop: "8px",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
              }}
            >
              {calendar.name}
            </div>
            <div
              style={{
                fontSize: "18px",
                opacity: 0.75,
                marginTop: "10px",
              }}
            >
              Free · No app required
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
