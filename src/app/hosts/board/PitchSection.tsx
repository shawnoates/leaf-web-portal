"use client";

/**
 * "Pitch your own event" on the host board.
 *
 * A host proposes a night in one of the neighborhoods they can pitch in (the
 * server only offers admin-run neighborhood calendars in the host's city). Leaf
 * picks the venue and, if it goes ahead, sends the host the usual offer. The
 * pay is Leaf's own quote, shown once the pitch is in.
 */

import { useEffect, useRef, useState } from "react";
import Parse from "@/lib/parse-client";

export type PitchOption = { calendarId: string; neighborhoodName: string; calendarName: string | null };

export type Pitch = {
  pitchId: string;
  status: "pending" | "approved" | "declined" | "withdrawn";
  title: string;
  neighborhoodName: string | null;
  whenLabel: string | null;
  venueText: string | null;
  priceLabel: string;
};

const PITCH_STATUS: Record<Pitch["status"], string> = {
  pending: "Waiting to hear back",
  approved: "We're going with it. Watch for the offer email.",
  declined: "Not this time",
  withdrawn: "Withdrawn",
};

const card = "rounded-2xl border border-zinc-200 bg-white p-5";
const btnPrimary =
  "rounded-lg bg-leaf-800 px-4 py-2.5 text-[15px] font-medium text-white " +
  "transition-colors hover:bg-leaf-900 disabled:opacity-50";
const btnQuiet =
  "rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-[15px] " +
  "font-medium text-leaf-900 transition-colors hover:border-zinc-400 disabled:opacity-50";
const inputClass =
  "w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-[16px] " +
  "text-leaf-900 placeholder:text-zinc-400 outline-none " +
  "focus:border-leaf-600 focus:ring-2 focus:ring-leaf-600/20";
const labelClass = "block text-[14px] font-medium text-leaf-900";

/** YYYY-MM-DD for today + n days, in the host's own timezone (for the date picker's bounds). */
function dayFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const EMPTY = { calendarId: "", title: "", description: "", date: "", time: "19:00", venueText: "", note: "" };

export default function PitchSection({
  token,
  options,
  pitches,
  busyHosting,
  onChanged,
}: {
  token: string;
  options: PitchOption[];
  pitches: Pitch[];
  busyHosting: boolean;
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  // The digest's "Pitch your event" link lands on #pitch: open the form and
  // bring it into view (the board renders after load, so the browser's own
  // anchor jump has nothing to jump to).
  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== "#pitch") return;
    if (!busyHosting && options.length > 0) setOpen(true);
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = (await Parse.Cloud.run("submitHostPitch", {
        token,
        ...form,
        calendarId: form.calendarId || options[0]?.calendarId,
      })) as { pitch: Pitch };
      setSent(r.pitch.priceLabel);
      setForm(EMPTY);
      setOpen(false);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your pitch.");
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (pitchId: string) => {
    setBusy(true);
    setError(null);
    try {
      await Parse.Cloud.run("withdrawHostPitch", { token, pitchId });
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not withdraw.");
    } finally {
      setBusy(false);
    }
  };

  const shownPitches = pitches.filter((p) => p.status !== "withdrawn");

  return (
    <section id="pitch" ref={sectionRef} className="mt-10 scroll-mt-6">
      <div className={`${card} bg-leaf-50/60`}>
        <h2 className="text-lg font-semibold text-leaf-900">Have your own idea? Pitch an event</h2>
        <p className="mt-1 text-[15px] leading-relaxed text-zinc-700">
          Tell us what you&apos;d run and when. If we go with it, we find the venue and email you an
          offer at our usual rate.
        </p>
        {/* Matches NEW_PEOPLE_BONUS on the server (host-marketplace-helpers.js). */}
        <p className="mt-2 rounded-lg bg-white px-3 py-2 text-[15px] text-leaf-900">
          <strong>+$50 bonus:</strong> if 10 people new to Leaf RSVP to your event, we add $50 to your pay.
        </p>

        {sent && (
          <p className="mt-3 rounded-lg bg-white p-3 text-[15px] text-leaf-900">
            Sent. If we go with it, we&apos;ll email you an offer. Pay: <strong>{sent}</strong>.
          </p>
        )}

        {busyHosting ? (
          <p className="mt-3 text-[15px] text-zinc-700">You can pitch another event once the one you are hosting is over.</p>
        ) : options.length === 0 ? (
          <p className="mt-3 text-[15px] text-zinc-700">
            There are no neighborhoods open for pitches in your city yet. We&apos;ll add more soon.
          </p>
        ) : !open ? (
          <button className={`${btnPrimary} mt-4`} onClick={() => { setOpen(true); setSent(null); }}>
            Pitch an event
          </button>
        ) : (
          <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className={labelClass}>Neighborhood</span>
              <select
                className={`${inputClass} mt-1`}
                value={form.calendarId || options[0]?.calendarId}
                onChange={set("calendarId")}
              >
                {options.map((o) => (
                  <option key={o.calendarId} value={o.calendarId}>
                    {o.neighborhoodName}
                  </option>
                ))}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className={labelClass}>Event name</span>
              <input
                className={`${inputClass} mt-1`}
                value={form.title}
                onChange={set("title")}
                maxLength={120}
                placeholder="Board games and pints"
                required
              />
            </label>
            <label className="sm:col-span-2">
              <span className={labelClass}>What you&apos;d do</span>
              <textarea
                className={`${inputClass} mt-1`}
                rows={3}
                value={form.description}
                onChange={set("description")}
                maxLength={1000}
                placeholder="A couple of sentences: what happens, who it's for."
                required
              />
            </label>
            <label>
              <span className={labelClass}>Date</span>
              <input
                type="date"
                className={`${inputClass} mt-1`}
                value={form.date}
                onChange={set("date")}
                min={dayFromNow(10)}
                max={dayFromNow(60)}
                required
              />
              <span className="mt-1 block text-[13px] text-zinc-500">10 to 60 days from now</span>
            </label>
            <label>
              <span className={labelClass}>Start time</span>
              <input
                type="time"
                className={`${inputClass} mt-1`}
                value={form.time}
                onChange={set("time")}
                required
              />
            </label>
            <label className="sm:col-span-2">
              <span className={labelClass}>
                A spot you have in mind <span className="font-normal text-zinc-500">(optional)</span>
              </span>
              <input
                className={`${inputClass} mt-1`}
                value={form.venueText}
                onChange={set("venueText")}
                maxLength={200}
                placeholder="The back room at a bar you like"
              />
            </label>
            <label className="sm:col-span-2">
              <span className={labelClass}>
                Anything else <span className="font-normal text-zinc-500">(optional)</span>
              </span>
              <textarea
                className={`${inputClass} mt-1`}
                rows={2}
                value={form.note}
                onChange={set("note")}
                maxLength={500}
              />
            </label>
            {error && <p className="text-[14px] text-red-700 sm:col-span-2">{error}</p>}
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <button type="submit" className={btnPrimary} disabled={busy}>
                {busy ? "Sending…" : "Send pitch"}
              </button>
              <button type="button" className={btnQuiet} disabled={busy} onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}
        {!open && error && <p className="mt-3 text-[14px] text-red-700">{error}</p>}
      </div>

      {shownPitches.length > 0 && (
        <div className="mt-4">
          <h3 className="text-[15px] font-semibold text-leaf-900">Your pitches</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {shownPitches.map((p) => (
              <div key={p.pitchId} className={`${card} flex min-w-0 items-start justify-between gap-3`}>
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-leaf-900">{p.title}</p>
                  <p className="text-[14px] text-zinc-600">
                    {[p.neighborhoodName, p.whenLabel].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-1 text-[14px] text-zinc-700">
                    {PITCH_STATUS[p.status]}
                    {p.status === "pending" ? ` · ${p.priceLabel}` : ""}
                  </p>
                </div>
                {p.status === "pending" && (
                  <button className={btnQuiet} disabled={busy} onClick={() => withdraw(p.pitchId)}>
                    Withdraw
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
