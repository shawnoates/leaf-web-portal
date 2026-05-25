import Link from "next/link";
import PlanWhen from "./PlanWhen";
import StandalonePlanRsvp from "./StandalonePlanRsvp";

type Variant = "standalone" | "copy" | "privateCalendar";

type Props = {
  variant: Variant;
  eventGroupId: string;
  title: string;
  description: string;
  image: string | null;
  expiryDate: string | null;
  location: { name: string; address: string } | null;
  hostName: string | null;
  calendarName: string | null;
  calendarProfilePhoto: string | null;
  // Only present when variant === "privateCalendar"
  shareId: string | null;
  // Affects "I'm Attending" vs "Request to Attend" button copy
  requireApproval: boolean;
  // Set when /p/<id>?rsvp=1 — the visitor was bounced back from
  // /open/p/<id>?rsvp=1 after iOS failed to intercept (no app installed),
  // so the StandalonePlanRsvp child opens its RSVP modal on mount.
  autoOpenRsvp: boolean;
};

export default function StandalonePlanCard({
  variant,
  eventGroupId,
  title,
  description,
  image,
  expiryDate,
  location,
  hostName,
  calendarName,
  calendarProfilePhoto,
  shareId,
  requireApproval,
  autoOpenRsvp,
}: Props) {
  const showWhen = variant !== "copy" && expiryDate !== null;
  const blurDetails = variant === "privateCalendar";

  return (
    <div className="min-h-dvh bg-zinc-50 px-4 py-6 md:py-10 flex justify-center items-start md:items-center">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm overflow-hidden">
        {image ? (
          <div
            className="w-full aspect-[4/3] bg-zinc-200 bg-cover bg-center"
            style={{ backgroundImage: `url(${image})` }}
          />
        ) : (
          <div className="w-full aspect-[4/3] bg-zinc-200" />
        )}
        <div className={`p-6 space-y-4 ${blurDetails ? "blur-[2px] select-none pointer-events-none" : ""}`}>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-zinc-900">{title}</h1>
            {calendarName && variant === "privateCalendar" ? (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                {calendarProfilePhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={calendarProfilePhoto}
                    alt=""
                    className="w-5 h-5 rounded-full"
                  />
                ) : null}
                <span>{calendarName}</span>
              </div>
            ) : null}
          </div>

          {showWhen && expiryDate ? <PlanWhen expiryDate={expiryDate} /> : null}

          {location ? (
            <div className="text-sm text-zinc-700">
              <div>{location.name}</div>
              {location.address ? (
                <div className="text-zinc-500">{location.address}</div>
              ) : null}
            </div>
          ) : null}

          {hostName ? (
            <div className="text-sm text-zinc-500">Hosted by {hostName}</div>
          ) : null}

          {description ? (
            <p className="text-sm text-zinc-600 whitespace-pre-wrap">
              {description}
            </p>
          ) : null}
        </div>

        <div className="p-6 pt-0 space-y-3">
          {variant === "privateCalendar" && shareId ? (
            <>
              <Link
                href={`/org/${shareId}`}
                className="block w-full text-center bg-zinc-900 text-white rounded-full py-3 text-sm font-medium hover:bg-zinc-800 transition"
              >
                Request to follow {calendarName ?? "calendar"}
              </Link>
              <p className="text-xs text-center text-zinc-500">
                Followers see plan details. You&apos;ll get notified when the host approves.
              </p>
            </>
          ) : null}

          {variant === "standalone" ? (
            <>
              <StandalonePlanRsvp
                eventGroupId={eventGroupId}
                planTitle={title}
                planDescription={description}
                expiryDate={expiryDate}
                location={location}
                requireApproval={requireApproval}
                autoOpenRsvp={autoOpenRsvp}
              />
              {/* /open/p/<id> is the Universal Link bouncer — iOS intercepts
                  and opens the Leaf app when installed; otherwise the bouncer
                  page server-redirects to the App Store. Plain <a> (not next
                  Link) so the browser does a full navigation that Safari can
                  hand off to iOS's UL machinery. */}
              <a
                href={`/open/p/${eventGroupId}`}
                className="block w-full text-center border border-zinc-200 text-zinc-900 rounded-full py-3 text-sm font-medium hover:bg-zinc-50 transition"
              >
                Open in Leaf
              </a>
              <p className="text-xs text-center text-zinc-500">
                RSVP in the browser, or open Leaf to chat with the host.
              </p>
            </>
          ) : null}

          {variant === "copy" ? (
            <>
              <a
                href={`/open/p/${eventGroupId}?copy=1`}
                className="block w-full text-center bg-zinc-900 text-white rounded-full py-3 text-sm font-medium hover:bg-zinc-800 transition"
              >
                Save this plan in Leaf
              </a>
              <p className="text-xs text-center text-zinc-500">
                Open Leaf to add this plan to your own calendar.
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
