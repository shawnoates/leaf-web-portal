"use client";

/*
 * "Watching for" (BETA): events the crew wants Leaf to look out for ("Nets
 * vs. Rockets", "Apparently Kidding"). Leaf searches weekly; when a date fits,
 * the organizer gets "It's a go?" and one tap sends the invites. Shown at the
 * top of the book and above the crew page's book row, only once something's
 * watched. Members add one from the book's search ("Watch for …"), its Add an
 * event form, or Tell Leaf ("let us know when…"); whoever added it, or the
 * organizer, can remove it.
 */

import { useState } from "react";
import { Search, X } from "lucide-react";
import { run, type CrewAuth, type WatchItem } from "@/lib/crew";

function dayLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

export default function WatchingStrip({ items, auth, isOwner, onChange }: {
  items: WatchItem[];
  auth: CrewAuth;
  isOwner: boolean;
  onChange: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError("");
    try { await fn(); await onChange(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(null); }
  };

  if (!items.length) return null;
  return (
    <section aria-label="Watching for" className="flex flex-col gap-2.5">
      <div className="flex items-center">
        <span className="flex items-center gap-2 font-fm-mono text-[11px] uppercase tracking-[0.12em] text-fm-muted">
          Watching for <span className="text-[9px] text-fm-accent">BETA</span>
        </span>
      </div>

      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((w) => (
            <li key={w.spotId} className="flex items-center gap-3 rounded-2xl border border-fm-line bg-fm-surface p-2.5 pr-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-fm-card">
                {w.next?.image
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={w.next.image} alt="" className="h-full w-full object-cover" />
                  : <Search size={18} aria-hidden className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-fm-accent" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold">{w.title}</div>
                <div className="truncate text-[13px] text-fm-muted">
                  {w.next
                    ? <>Next: {w.next.url ? <a href={w.next.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-fm-ink">{dayLabel(w.next.date)}</a> : dayLabel(w.next.date)} · {w.next.watchParty ? `${w.next.venueName} (watch together)` : w.next.venueName}</>
                    : "Leaf looks for dates every week"}
                  {w.addedBy && !w.addedByMe ? ` · ${w.addedBy}` : ""}
                </div>
              </div>
              {(w.addedByMe || isOwner) && (
                <button type="button" aria-label={`Stop watching for ${w.title}`} disabled={busy !== null}
                  onClick={() => act(`rm-${w.spotId}`, () => run("removeFromCrewBook", auth, { spotId: w.spotId }))}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-fm-muted hover:bg-fm-card hover:text-fm-ink disabled:opacity-50">
                  <X size={16} aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="m-0 text-sm text-fm-danger">{error}</p>}
    </section>
  );
}
