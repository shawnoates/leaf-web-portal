import Link from "next/link";

const APP_STORE_URL =
  "https://apps.apple.com/us/app/leaf-build-your-community/id1040588046";

type Variant = "standalone" | "copy" | "privateCalendar";

type Props = {
  variant: Variant;
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
};

function formatWhen(expiryDate: string | null): { date: string; time: string } | null {
  if (!expiryDate) return null;
  const d = new Date(expiryDate);
  if (Number.isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return { date, time };
}

export default function StandalonePlanCard({
  variant,
  title,
  description,
  image,
  expiryDate,
  location,
  hostName,
  calendarName,
  calendarProfilePhoto,
  shareId,
}: Props) {
  const when = variant === "copy" ? null : formatWhen(expiryDate);
  const blurDetails = variant === "privateCalendar";

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 flex items-center justify-center">
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

          {when ? (
            <div className="text-sm text-zinc-700">
              <div>{when.date}</div>
              <div className="text-zinc-500">{when.time}</div>
            </div>
          ) : null}

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
              <a
                href={APP_STORE_URL}
                className="block w-full text-center bg-zinc-900 text-white rounded-full py-3 text-sm font-medium hover:bg-zinc-800 transition"
              >
                Open in Leaf
              </a>
              <p className="text-xs text-center text-zinc-500">
                Get the app to RSVP and chat with the host.
              </p>
            </>
          ) : null}

          {variant === "copy" ? (
            <>
              <a
                href={APP_STORE_URL}
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
