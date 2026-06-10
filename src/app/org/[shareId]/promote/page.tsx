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

type Template = "flyer" | "social";

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
          padding: "0.7in 0.7in 0.5in",
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
          Leaf · Resident calendar
        </div>
        <h1
          style={{
            fontSize: "54px",
            fontWeight: 800,
            lineHeight: 1.02,
            marginTop: "16px",
            letterSpacing: "-0.02em",
          }}
        >
          Meet your neighbors.
        </h1>
        <p
          style={{
            marginTop: "12px",
            fontSize: "18px",
            fontWeight: 300,
            opacity: 0.95,
            maxWidth: "5.5in",
            lineHeight: 1.35,
          }}
        >
          {calendar.name} has a shared calendar for residents to organize and
          RSVP to building events.
        </p>
      </div>

      {/* Sample plans */}
      <div style={{ padding: "0.45in 0.7in 0.3in", flex: 1 }}>
        <div
          style={{
            fontSize: "10px",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: "#71717a",
            marginBottom: "14px",
          }}
        >
          What residents organize
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "14px",
          }}
        >
          <PlanCard
            emoji="🎳"
            title="Bowling Night"
            when="Fri 7:30 PM"
            where="Frames Lanes"
          />
          <PlanCard
            emoji="🥒"
            title="Pickleball"
            when="Sat 6:00 PM"
            where="Lincoln Park"
          />
          <PlanCard
            emoji="🍷"
            title="Rooftop Mixer"
            when="Sun 6:30 PM"
            where="Building Rooftop"
          />
        </div>
      </div>

      {/* QR section */}
      <div
        style={{
          padding: "0.4in 0.7in 0.6in",
          borderTop: "1px solid #f4f4f5",
          display: "flex",
          alignItems: "center",
          gap: "0.4in",
        }}
      >
        <div
          style={{
            background: "white",
            border: "3px solid #064e3b",
            padding: "10px",
            borderRadius: "4px",
          }}
        >
          <QRCodeSVG value={url} size={160} level="M" />
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: "11px",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: "#047857",
            }}
          >
            Scan to join — 30 seconds
          </div>
          <div
            style={{
              fontSize: "28px",
              fontWeight: 800,
              marginTop: "6px",
              letterSpacing: "-0.01em",
              lineHeight: 1.1,
            }}
          >
            {calendar.name}
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "#71717a",
              marginTop: "8px",
              wordBreak: "break-all",
            }}
          >
            {url}
          </div>
          <div
            style={{
              fontSize: "10px",
              color: "#a1a1aa",
              marginTop: "10px",
            }}
          >
            Free for residents · No app required
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  emoji,
  title,
  when,
  where,
}: {
  emoji: string;
  title: string;
  when: string;
  where: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #e4e4e7",
        borderRadius: "12px",
        padding: "14px",
        background: "#fafafa",
      }}
    >
      <div style={{ fontSize: "22px" }}>{emoji}</div>
      <div
        style={{
          fontSize: "14px",
          fontWeight: 700,
          marginTop: "6px",
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: "11px",
          color: "#52525b",
          marginTop: "4px",
        }}
      >
        {when}
      </div>
      <div
        style={{
          fontSize: "11px",
          color: "#a1a1aa",
        }}
      >
        {where}
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
          Leaf · Resident calendar
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
            Meet your
            <br />
            neighbors.
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
            {calendar.name} has a calendar for resident events — bowling,
            pickleball, happy hours, dinners.
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
