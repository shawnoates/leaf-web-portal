"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import Parse from "@/lib/parse-client";

/**
 * "Friends you texted" — Home's record of Text your friends (the app's
 * one-at-a-time Messages queue, server: text-invites.js). Who was texted,
 * who opened their link, who now follows; in the app, Text friends starts a
 * new round and Text again re-texts anyone who hasn't followed yet.
 *
 * Off the app the queue can't run (a web page can't open Messages one friend
 * at a time), so the card shows the record only, and nothing at all until
 * there is one.
 */

type Friend = {
  phone: string;
  name: string;
  /** Which calendar they were texted for: the organization's card covers the
   *  calendars under it too. Absent on older servers. */
  calendarId?: string;
  calendarName?: string;
  status: "sent" | "opened" | "joined";
  sentAt: string | null;
};

const SHOWN = 5;

function formatPhone(p: string) {
  const d = p.replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}` : p;
}

function chip(f: Friend) {
  if (f.status === "joined") return { label: "Following", cls: "bg-emerald-50 text-emerald-700" };
  if (f.status === "opened") return { label: "Opened", cls: "bg-amber-50 text-amber-700" };
  const when = f.sentAt ? new Date(f.sentAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null;
  return { label: when ? `Texted ${when}` : "Texted", cls: "bg-zinc-100 text-zinc-600" };
}

export default function TextedFriendsCard({ calendarId }: { calendarId: string }) {
  // Only mounted client-side, after the dashboard loads. An app build with
  // the queue says so in its user agent (LeafText/1).
  const [nativeText] = useState(() => typeof navigator !== "undefined" && /LeafText\//.test(navigator.userAgent));
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [counts, setCounts] = useState({ texted: 0, opened: 0, following: 0 });
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = (await Parse.Cloud.run("getTextInvites", { calendarId })) as {
        friends: Friend[];
        counts: { texted: number; opened: number; following: number };
      };
      setFriends(r.friends);
      setCounts(r.counts);
    } catch {
      setFriends([]);
    }
  }, [calendarId]);

  // Coming back from the queue (or a friend following meanwhile) refreshes it.
  // The first load is deferred a tick, as in PlanIntroSection
  // (react-hooks/set-state-in-effect).
  useEffect(() => {
    const t = setTimeout(() => { void load(); }, 0);
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [load]);

  if (friends === null) return null;
  if (friends.length === 0 && !nativeText) return null;

  const newHref = `leaf://text-friends/${calendarId}`;
  // Text again goes per calendar: each friend's link is for the calendar they
  // were texted about. `to=<phone>|<name>` per friend. encodeURIComponent, not
  // URLSearchParams: iOS's URLComponents reads "%20" as a space but leaves a
  // form-style "+".
  const againByCalendar = new Map<string, { name: string; friends: Friend[] }>();
  for (const f of friends) {
    if (f.status === "joined") continue;
    const id = f.calendarId || calendarId;
    const g = againByCalendar.get(id) || { name: f.calendarName || "", friends: [] };
    g.friends.push(f);
    againByCalendar.set(id, g);
  }
  const againLinks = [...againByCalendar.entries()].map(([id, g]) => ({
    id,
    name: g.name,
    count: g.friends.length,
    href: `leaf://text-friends/${id}?${g.friends.map((f) => `to=${encodeURIComponent(`${f.phone}|${f.name}`)}`).join("&")}`,
  }));
  const manyCalendars = new Set(friends.map((f) => f.calendarId || calendarId)).size > 1;

  if (friends.length === 0) {
    return (
      <div className="border border-zinc-200 rounded-xl p-4">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-zinc-500 uppercase mb-2">Text your friends</p>
        <p className="text-sm text-zinc-600 mb-3">
          Each one gets their own message and link from your iMessage. You tap Send for each.
        </p>
        <a
          href={newHref}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-zinc-900 text-white rounded-full text-xs font-medium hover:bg-zinc-800 transition-colors"
        >
          <MessageCircle className="w-3.5 h-3.5" /> Text friends
        </a>
      </div>
    );
  }

  const shown = showAll ? friends : friends.slice(0, SHOWN);
  return (
    <div className="border border-zinc-200 rounded-xl p-4">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-zinc-500 uppercase mb-1">Friends you texted</p>
      <p className="text-xs text-zinc-500 mb-3">
        {counts.texted} texted · {counts.opened} opened · {counts.following} following
      </p>
      <ul className="divide-y divide-zinc-100">
        {shown.map((f) => {
          const c = chip(f);
          return (
            <li key={`${f.phone}|${f.calendarId || ""}`} className="flex items-center gap-2 py-2">
              <span className="flex-1 min-w-0">
                <span className="block truncate text-sm text-zinc-900">{f.name || formatPhone(f.phone)}</span>
                {manyCalendars && f.calendarName && (
                  <span className="block truncate text-[11px] text-zinc-500">{f.calendarName}</span>
                )}
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${c.cls}`}>{c.label}</span>
            </li>
          );
        })}
      </ul>
      {friends.length > SHOWN && (
        <button onClick={() => setShowAll((v) => !v)} className="mt-1 text-xs text-zinc-500 hover:text-zinc-900">
          {showAll ? "Show fewer" : `Show all ${friends.length}`}
        </button>
      )}
      {nativeText ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={newHref}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-zinc-900 text-white rounded-full text-xs font-medium hover:bg-zinc-800 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" /> Text friends
          </a>
          {againLinks.map((a) => (
            <a
              key={a.id}
              href={a.href}
              className="inline-flex items-center px-4 py-2.5 border border-zinc-200 rounded-full text-xs font-medium text-zinc-900 hover:bg-zinc-50 transition-colors"
            >
              Text again{againLinks.length > 1 && a.name ? ` · ${a.name}` : ""} · {a.count}
            </a>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-zinc-500">Text more friends from the Leaf app.</p>
      )}
    </div>
  );
}
