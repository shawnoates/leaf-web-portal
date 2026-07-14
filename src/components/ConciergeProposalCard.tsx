"use client";

import { useState } from "react";
import Parse from "@/lib/parse-client";
import { Check, Loader2, MapPin, Wallet, Users, Calendar, Pencil, Clock } from "lucide-react";

export interface ConciergeProposal {
  objectId: string;
  status: string;
  eventType: string | null;
  venueMode: string | null;
  title: string | null;
  description: string | null;
  image: string | null;
  venueName: string | null;
  date: string | null;
  time: string | null;
  capacity: number | null;
  residentCost: string | null;
  notes: string | null;
  isDeferred: boolean;
  ownerReviewDeadline: string | null;
  extensionCount: number;
  personaName: string | null;
}

/**
 * Owner-facing review card for a materialized proposal in `owner_review`. The
 * owner can approve, safe-edit inline (title/description/notes/capacity-down),
 * request changes, or extend the window. Silence auto-approves at the deadline
 * (handled server-side) — the card just surfaces that.
 */
export default function ConciergeProposalCard({
  proposal,
  onChanged,
  onFirstApproval,
}: {
  proposal: ConciergeProposal;
  onChanged: () => void;
  onFirstApproval: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(proposal.title || "");
  const [description, setDescription] = useState(proposal.description || "");
  const [notes, setNotes] = useState(proposal.notes || "");
  const [askChanges, setAskChanges] = useState(false);
  const [changeNote, setChangeNote] = useState("");

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(null);
    }
  };

  const approve = () =>
    run("approve", async () => {
      const r = (await Parse.Cloud.run("ownerApproveProposal", { proposalId: proposal.objectId })) as {
        prefsPrompt?: boolean;
      };
      if (r?.prefsPrompt) onFirstApproval();
    });

  const saveEdits = () =>
    run("edit", async () => {
      // Each changed safe field routes through ownerEditProposal (inline).
      if (title !== (proposal.title || "")) await Parse.Cloud.run("ownerEditProposal", { proposalId: proposal.objectId, field: "title", value: title });
      if (description !== (proposal.description || "")) await Parse.Cloud.run("ownerEditProposal", { proposalId: proposal.objectId, field: "description", value: description });
      if (notes !== (proposal.notes || "")) await Parse.Cloud.run("ownerEditProposal", { proposalId: proposal.objectId, field: "notes", value: notes });
      setEditing(false);
    });

  const submitChanges = () =>
    run("changes", async () => {
      await Parse.Cloud.run("ownerRequestChanges", { proposalId: proposal.objectId, note: changeNote });
      setAskChanges(false);
    });

  // Dates are stored at UTC midnight — format in UTC so the day never shifts.
  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }) : null;
  const fmtTime = (t: string | null) => {
    if (!t) return null;
    const m = /^(\d{1,2}):(\d{2})/.exec(t);
    if (!m) return t;
    let h = parseInt(m[1], 10);
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m[2]} ${ampm}`;
  };
  const deadline = proposal.ownerReviewDeadline
    ? new Date(proposal.ownerReviewDeadline).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })
    : null;

  // Only assert a premise we can back up. Until a venue is confirmed, an
  // off-site or unknown-mode event shows an honest TBD instead of "On-premise".
  const locationLabel = proposal.venueName
    ? proposal.venueName
    : proposal.eventType === "off_premise" || proposal.eventType === "marketplace"
      ? "Off-site — we'll confirm the venue"
      : proposal.venueMode === "on_premise"
        ? "On-premise"
        : proposal.venueMode === "mixed"
          ? "On-premise or nearby"
          : "Venue TBD";

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
      {proposal.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={proposal.image} alt={proposal.title || ""} className="h-32 w-full object-cover" />
      ) : (
        <div className="h-32 w-full bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center">
          <Calendar className="w-6 h-6 text-zinc-300" />
        </div>
      )}
      <div className="p-3.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1">Ready for your approval</p>

        {editing ? (
          <div className="space-y-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-zinc-300 rounded-lg px-2.5 py-1.5 text-sm font-medium focus:outline-none focus:border-zinc-500" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Description" className="w-full border border-zinc-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-zinc-500 resize-y" />
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes for residents" className="w-full border border-zinc-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-zinc-500 resize-y" />
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900">Cancel</button>
              <button onClick={saveEdits} disabled={!!busy} className="ml-auto inline-flex items-center gap-1.5 bg-zinc-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 disabled:opacity-60">
                {busy === "edit" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
              </button>
            </div>
          </div>
        ) : (
          <>
            <h4 className="text-sm font-semibold text-zinc-900">{proposal.title}</h4>
            {proposal.description && <p className="text-xs text-zinc-500 leading-snug mt-0.5 whitespace-pre-line">{proposal.description}</p>}
            <div className="mt-2 space-y-0.5 text-[11px] text-zinc-500">
              {(fmtDate(proposal.date) || proposal.time) && (
                <p className="flex items-center gap-1"><Calendar className="w-3 h-3 shrink-0 text-zinc-400" /> {[fmtDate(proposal.date), fmtTime(proposal.time)].filter(Boolean).join(" · ")}</p>
              )}
              <p className="flex items-center gap-1"><MapPin className="w-3 h-3 shrink-0 text-zinc-400" /> {locationLabel}</p>
              {proposal.residentCost && <p className="flex items-center gap-1"><Wallet className="w-3 h-3 shrink-0 text-zinc-400" /> {proposal.residentCost}</p>}
              {typeof proposal.capacity === "number" && <p className="flex items-center gap-1"><Users className="w-3 h-3 shrink-0 text-zinc-400" /> Up to {proposal.capacity}</p>}
            </div>
            {deadline && (
              <p className="mt-2 text-[11px] text-zinc-400 flex items-center gap-1">
                <Clock className="w-3 h-3 shrink-0" /> Auto-confirms {deadline} unless you weigh in
              </p>
            )}

            {askChanges ? (
              <div className="mt-3 space-y-2">
                <textarea value={changeNote} onChange={(e) => setChangeNote(e.target.value)} rows={2} placeholder="What would you like changed? (venue, date, cost…)" className="w-full border border-zinc-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-zinc-500 resize-y" />
                <div className="flex gap-2">
                  <button onClick={() => setAskChanges(false)} className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900">Cancel</button>
                  <button onClick={submitChanges} disabled={!!busy} className="ml-auto bg-zinc-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 disabled:opacity-60">
                    {busy === "changes" ? "Sending…" : "Send to concierge"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button onClick={approve} disabled={!!busy} className="inline-flex items-center gap-1.5 bg-zinc-900 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 disabled:opacity-60">
                  {busy === "approve" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Approve
                </button>
                <button onClick={() => setAskChanges(true)} disabled={!!busy} className="inline-flex items-center px-4 py-2 rounded-lg border border-zinc-300 text-zinc-700 text-xs font-bold uppercase tracking-widest hover:bg-zinc-100 disabled:opacity-50">
                  Request changes
                </button>
                <button onClick={() => setEditing(true)} disabled={!!busy} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 disabled:opacity-50">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
              </div>
            )}
          </>
        )}

        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
}
