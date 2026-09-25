"use client";

/**
 * "Which calendar?" — for someone who owns calendars and wants Friend Mode.
 * Lists every calendar they own (org and children) with whether Friend Mode
 * can go on it (Friends / Community, up to 15 members), then hands the pick
 * to the setup pop-up. The last row is New calendar when their plan has
 * room, or Upgrade to Pro when it doesn't.
 *
 * Those two rows are plain <a> links, not next/link: in the iOS app's web
 * view a real link tap is sent to Safari, which keeps the dashboard (and its
 * Stripe checkout) out of the app. Client-side navigation would bypass that.
 */

import { useEffect, useState } from "react";
import { ArrowRight, Lock, Plus, X } from "lucide-react";
import Parse from "@/lib/parse-client";
import { FriendModeMark } from "@/components/crew/FriendModeGlyphs";

type FM = { enabled: boolean; memberCount: number; eligible?: boolean };
type Org = { objectId: string; name: string };
type Dash = {
  isOwner: boolean;
  name: string;
  tier?: string;
  calendarLimit?: number | null;
  friendMode?: FM;
  calendars?: { objectId: string; name: string; friendMode?: FM }[];
};
type Row = { id: string; name: string; orgId: string; fm: FM | undefined };

export default function FriendModeCalendarPicker({
  onPick,
  onClose,
}: {
  onPick: (calendar: { id: string; name: string }) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  // Where "New calendar" goes: the first org with room, else the first org's
  // settings (Upgrade). Null while loading or when they own nothing.
  const [add, setAdd] = useState<{ orgId: string; atLimit: boolean } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const orgs = ((await Parse.Cloud.run("getMyOrganizations")) as { organizations?: Org[] }).organizations || [];
        const dashes = await Promise.all(
          orgs.map((o) => Parse.Cloud.run("getOrgDashboard", { calendarId: o.objectId }).then((d: Dash) => ({ o, d })).catch(() => null)),
        );
        if (!live) return;
        const out: Row[] = [];
        let addTo: { orgId: string; atLimit: boolean } | null = null;
        for (const x of dashes) {
          if (!x || !x.d.isOwner) continue;
          const { o, d } = x;
          out.push({ id: o.objectId, name: d.name || o.name, orgId: o.objectId, fm: d.friendMode });
          for (const c of d.calendars || []) {
            if (c.objectId !== o.objectId) out.push({ id: c.objectId, name: c.name, orgId: o.objectId, fm: c.friendMode });
          }
          const atLimit = !!(d.calendarLimit && (d.calendars || []).length >= d.calendarLimit);
          if (!addTo || (addTo.atLimit && !atLimit)) addTo = { orgId: o.objectId, atLimit };
        }
        setRows(out);
        setAdd(addTo);
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : "Couldn't load your calendars.");
      }
    })();
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fm fixed inset-0 z-[60] flex items-end justify-center bg-fm-canvas/80 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fm-pick-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full flex-col rounded-t-[28px] bg-fm-canvas font-fm-sans text-fm-ink sm:max-w-[520px] sm:rounded-[28px]"
      >
        <div className="flex items-center justify-between px-6 pb-2 pt-6">
          <div className="flex items-center gap-2.5">
            <FriendModeMark width={36} />
            <span className="font-fm-mono text-[11px] uppercase tracking-[0.08em] text-fm-muted">Friend Mode</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-2.5 flex h-11 w-11 items-center justify-center rounded-full text-fm-muted hover:text-fm-ink">
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className="px-6">
          <h2 id="fm-pick-title" className="m-0 font-fm-serif text-[30px] font-normal leading-tight">Which calendar?</h2>
          <p className="mb-0 mt-1.5 text-sm text-fm-ink-2">Friend Mode runs on one of your calendars. It&rsquo;s for Friends &amp; Community calendars with up to 15 people.</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
          {error && <p className="m-0 text-sm text-fm-danger">{error}</p>}
          {!rows && !error && <p className="m-0 text-sm text-fm-muted">Loading your calendars…</p>}
          {rows && (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {rows.map((r) => {
                const on = r.fm?.enabled;
                const ok = !on && r.fm?.eligible !== false;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      disabled={!ok}
                      onClick={() => onPick({ id: r.id, name: r.name })}
                      className={`flex min-h-[60px] w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left ${
                        ok ? "border-fm-line bg-fm-surface hover:border-fm-ink-2" : "border-fm-line-dim bg-transparent"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-[15px] font-semibold ${ok ? "" : "text-fm-muted"}`}>{r.name}</span>
                        <span className="block text-[13px] text-fm-muted">
                          {on ? "Friend Mode is on" : ok ? `${r.fm?.memberCount ?? 0} ${r.fm?.memberCount === 1 ? "member" : "members"}` : "Friends & Community calendars only, up to 15 people"}
                        </span>
                      </span>
                      {on ? <span className="text-xs font-medium text-fm-accent">On</span> : ok ? <ArrowRight size={18} className="shrink-0 text-fm-ink" aria-hidden /> : <Lock size={16} className="shrink-0 text-fm-muted" aria-hidden />}
                    </button>
                  </li>
                );
              })}
              {add && (
                <li>
                  {add.atLimit ? (
                    <a href={`/dashboard/${add.orgId}?tab=settings`} className="flex min-h-[60px] w-full items-center gap-3 rounded-2xl border border-dashed border-fm-line px-4 py-3 hover:border-fm-ink-2">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold">Upgrade to Pro</span>
                        <span className="block text-[13px] text-fm-muted">Your plan is at its calendar limit. Pro adds more, so you can make one just for your crew.</span>
                      </span>
                      <ArrowRight size={18} className="shrink-0" aria-hidden />
                    </a>
                  ) : (
                    <a href={`/dashboard/${add.orgId}?tab=calendars`} className="flex min-h-[60px] w-full items-center gap-3 rounded-2xl border border-dashed border-fm-line px-4 py-3 hover:border-fm-ink-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-fm-line-dim bg-fm-surface"><Plus size={16} aria-hidden /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold">New calendar</span>
                        <span className="block text-[13px] text-fm-muted">Make one just for your crew, then turn Friend Mode on there.</span>
                      </span>
                    </a>
                  )}
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
