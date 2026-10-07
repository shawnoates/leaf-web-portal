"use client";

/**
 * The welcome popup for a placard QR scan (/org/<calendar>?src=<code>).
 *
 * Someone scanned the counter card or table tent at a business, so they're
 * standing in it: "You're at Bean There", then the suggested plans made for
 * that place (leaflets-server offer-placard-ideas.js), at most one a week.
 * Each card has the calendar's usual heart and Host this, wired to the same
 * handlers as the main list's suggested plans; this only lays them out.
 * Sits just under z-50 so the follow sheet a heart opens shows on top of it.
 */

import { Heart, Loader2, X } from "lucide-react";

type Idea = {
  id: string;
  title: string;
  description: string;
  date: string | null;
  preferredTime?: string | null;
  audienceTag?: string | null;
  /** One of the business's own classes: book on its site. */
  bookingUrl?: string | null;
  classTitle?: string | null;
};

/** "Tue, Oct 13 · 9:30 AM". The date is stored at noon UTC, so read it in UTC. */
function whenLabel(idea: Idea) {
  const day = idea.date
    ? new Date(idea.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })
    : "";
  const m = String(idea.preferredTime || "").match(/^(\d{1,2}):(\d{2})$/);
  const time = m
    ? `${((Number(m[1]) + 11) % 12) + 1}${m[2] === "00" ? "" : `:${m[2]}`} ${Number(m[1]) < 12 ? "AM" : "PM"}`
    : "";
  return [day, time].filter(Boolean).join(" · ");
}

export default function PlacardWelcome<T extends Idea>({
  name,
  photoUrl,
  ideas,
  brandColor,
  canHost,
  counts,
  interested,
  pending,
  onHeart,
  onHost,
  onClose,
}: {
  name: string;
  photoUrl: string | null;
  ideas: T[];
  brandColor: string;
  canHost: boolean;
  counts: Record<string, number>;
  interested: Set<string>;
  pending: Set<string>;
  onHeart: (id: string) => void;
  onHost: (idea: T) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-[44] bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="placard-welcome-title"
        className="fixed inset-x-0 bottom-0 z-[45] max-h-[88vh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[440px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
        style={{ animation: "slideUp 0.3s ease-out" }}
      >
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 rounded-full bg-white/80 p-1.5 text-zinc-500 hover:text-zinc-800">
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 px-5 pb-2 pt-5">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" referrerPolicy="no-referrer" className="h-10 w-10 shrink-0 rounded-full object-cover" />
          ) : null}
          <div className="min-w-0 pr-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">You&rsquo;re at</p>
            <h2 id="placard-welcome-title" className="truncate font-fm-serif text-[22px] leading-tight text-zinc-900">
              {name}
            </h2>
          </div>
        </div>
        <p className="px-5 text-[14px] leading-snug text-zinc-600">
          Neighbors could meet here. Heart the ones you&rsquo;d come to{canHost ? ", or host one" : ""}.
        </p>

        {/* A plain list, one row of actions each: heart, then Book (a class) and Host. */}
        <ul className="mt-2 divide-y divide-zinc-100 px-5">
          {ideas.map((idea) => {
            const count = counts[idea.id] ?? 0;
            const isIn = interested.has(idea.id);
            const busy = pending.has(idea.id);
            return (
              <li key={idea.id} className="py-4">
                <p className="text-[12px] font-medium text-zinc-500">{whenLabel(idea)}</p>
                <h3 className="mt-0.5 text-[16px] font-semibold leading-snug text-zinc-900">{idea.title}</h3>
                {idea.description && <p className="mt-0.5 line-clamp-2 text-[13.5px] leading-snug text-zinc-600">{idea.description}</p>}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onHeart(idea.id)}
                    disabled={isIn || busy}
                    aria-pressed={isIn}
                    aria-label={isIn ? "You're in" : "I'd come"}
                    title={isIn ? "You're in" : "I'd come"}
                    className={`flex h-9 shrink-0 items-center justify-center gap-1 rounded-full border px-3 text-[13px] font-semibold transition-colors disabled:cursor-default ${
                      isIn ? "border-rose-200 bg-rose-50 text-rose-600" : "border-zinc-200 text-zinc-700 hover:border-zinc-300"
                    }`}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4" fill={isIn ? "currentColor" : "none"} />}
                    {/* A class card has two more buttons, so its heart is just the icon. */}
                    {!idea.bookingUrl && <span>{isIn ? "You're in" : "I'd come"}</span>}
                    {count > 0 && <span className="font-normal text-zinc-500">{count}</span>}
                  </button>
                  {idea.bookingUrl && (
                    <a
                      href={idea.bookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-9 flex-1 items-center justify-center whitespace-nowrap rounded-full px-3 text-[13px] font-semibold text-white hover:opacity-90"
                      style={{ backgroundColor: brandColor }}
                    >
                      Book your spot
                    </a>
                  )}
                  {canHost && (
                    <button
                      type="button"
                      onClick={() => onHost(idea)}
                      // A class: booking is the main thing; hosting means "I'll be there, join me".
                      title={idea.bookingUrl ? "I\u2019ll be there, join me" : undefined}
                      className={
                        idea.bookingUrl
                          ? "h-9 shrink-0 rounded-full border border-zinc-300 px-3.5 text-[13px] font-semibold text-zinc-800 hover:border-zinc-400"
                          : "h-9 flex-1 rounded-full text-[13px] font-semibold text-white hover:opacity-90"
                      }
                      style={idea.bookingUrl ? undefined : { backgroundColor: brandColor }}
                    >
                      {idea.bookingUrl ? "Host it" : "Host this"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="border-t border-zinc-100 px-5 py-3 text-center">
          <button type="button" onClick={onClose} className="text-[14px] font-semibold text-zinc-600 underline underline-offset-4">
            See the whole calendar
          </button>
        </div>
      </div>
    </>
  );
}
