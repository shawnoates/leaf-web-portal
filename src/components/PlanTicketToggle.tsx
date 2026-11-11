"use client";

import { useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import { Check } from "lucide-react";

type Roster = { going: number; withTicket: number; mine: boolean | null };

/**
 * "I have my ticket" for a web guest going to a plan made from a ticketed
 * event, plus how many in the group have one (getPlanTickets / setHasTicket).
 * Renders nothing until the viewer is signed in and going — phone
 * verification at RSVP signs them in, so it appears right after they RSVP.
 */
export default function PlanTicketToggle({ eventGroupId, refreshKey }: { eventGroupId: string; refreshKey?: string | number | boolean }) {
  const [roster, setRoster] = useState<Roster | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      if (!Parse.User.current()) return;
    } catch { return; }
    Parse.Cloud.run("getPlanTickets", { eventGroupId })
      .then((r: Roster) => { if (!cancelled) setRoster(r); })
      .catch(() => { if (!cancelled) setRoster(null); });
    return () => { cancelled = true; };
  }, [eventGroupId, refreshKey]);

  if (!roster || roster.mine === null) return null;
  const mine = roster.mine;

  async function toggle() {
    setSaving(true);
    setError(null);
    try {
      const r = (await Parse.Cloud.run("setHasTicket", { eventGroupId, hasTicket: !mine })) as Roster;
      setRoster(r);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "That didn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const summary = roster.withTicket === roster.going
    ? "Everyone going has a ticket"
    : `${roster.withTicket} of ${roster.going} going have a ticket`;

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        aria-pressed={mine}
        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border transition-colors disabled:opacity-60 ${
          mine ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-white border-zinc-300 text-zinc-800 hover:bg-zinc-50"
        }`}
      >
        <span className={`w-4 h-4 rounded-full grid place-items-center border ${mine ? "bg-emerald-600 border-emerald-600" : "border-zinc-400"}`} aria-hidden>
          {mine && <Check className="w-3 h-3 text-white" />}
        </span>
        I have my ticket
      </button>
      <p className="text-xs text-zinc-500">{summary}</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
