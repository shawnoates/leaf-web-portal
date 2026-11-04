"use client";

import { useMemo, useState } from "react";
import { Check, MessageCircle } from "lucide-react";
import Parse from "@/lib/parse-client";

/**
 * Grow → Invite friends: Text your friends on the web (server:
 * text-invites.js). The host pastes names and numbers, Leaf makes each friend
 * their own tracked link, and every row gets a Text button that opens
 * Messages for that one person with the message filled in. On a Mac that's
 * the host's own iMessage; on a phone, the Messages app. Leaf sends nothing.
 *
 * A browser can't read the address book, so the list is pasted. In the app
 * (LeafText/1) the native queue does the same from contacts, one tap each.
 */

type Cal = { objectId: string; name: string; activePlans?: { objectId: string; title: string; date: string; isPoll?: boolean }[] };

type Invite = { token: string; phone: string; name: string; first: string; url: string; textedAt: string | null };

type Row = Invite & { tapped: boolean };

const CAL_TEMPLATE = "Hey {first}! I host nights with {calendar}. Follow along to see what's coming up and join any you like: {link}";

/** "Dana Kim 917-555-0101", "917.555.0101 Dana", "Dana, +1 (917) 555 0101": one per line or comma. */
export function parseContacts(text: string): { name: string; phone: string }[] {
  const out: { name: string; phone: string }[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\n|;/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/(\+?\d[\d\s().-]{8,}\d)/);
    if (!m) continue;
    const digits = m[1].replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) continue;
    const name = line.replace(m[1], "").replace(/[,:;–—-]+/g, " ").replace(/\s+/g, " ").trim();
    if (seen.has(digits)) continue;
    seen.add(digits);
    out.push({ name, phone: digits });
  }
  return out;
}

function fill(template: string, inv: Invite) {
  let text = inv.first
    ? template.replace(/\{first\}/g, inv.first)
    : template.replace(/ ?\{first\}/g, "");
  text = text.includes("{link}") ? text.replace(/\{link\}/g, inv.url) : `${text} ${inv.url}`;
  return text;
}

/** One recipient per message, always: several would start a group chat. */
function smsHref(phone: string, body: string) {
  // "?&body=" works on both iOS/macOS (which read &body) and Android (?body).
  return `sms:${phone}?&body=${encodeURIComponent(body)}`;
}

export default function InviteFriendsSection({
  calendars,
  defaultCalendarId,
  defaultPlanId = "",
  onCalendarChange,
}: {
  calendars: Cal[];
  defaultCalendarId: string;
  /** Opened from a plan's "Text friends" row: that plan, picked. */
  defaultPlanId?: string;
  /** The picked calendar, so the page can show who was texted for it. */
  onCalendarChange?: (calendarId: string) => void;
}) {
  const [nativeText] = useState(() => typeof navigator !== "undefined" && /LeafText\//.test(navigator.userAgent));
  const [calendarId, setCalendarId] = useState(defaultCalendarId);
  const [planId, setPlanId] = useState(defaultPlanId);
  const [pasted, setPasted] = useState("");
  const [template, setTemplate] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [already, setAlready] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const calendar = calendars.find((c) => c.objectId === calendarId) || calendars[0];
  const plans = useMemo(
    () =>
      (calendar?.activePlans ?? [])
        .filter((p) => !p.isPoll && new Date(p.date).getTime() > Date.now())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [calendar],
  );
  const parsed = useMemo(() => parseContacts(pasted), [pasted]);
  const defaultTemplate = CAL_TEMPLATE.replace("{calendar}", calendar?.name || "my calendar");

  const reset = () => { setRows(null); setTemplate(null); setAlready([]); setError(""); };

  const makeLinks = async () => {
    if (!calendar || parsed.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const r = (await Parse.Cloud.run("createTextInvites", {
        calendarId: calendar.objectId,
        ...(planId ? { planId } : {}),
        contacts: parsed.slice(0, 50),
      })) as { template: string; invites: Invite[]; alreadyFollowing: { phone: string; name: string }[] };
      // Keep the host's own wording if they edited the default before.
      setTemplate((t) => t ?? r.template);
      setRows(r.invites.map((i) => ({ ...i, tapped: false })));
      setAlready(r.alreadyFollowing.map((a) => a.name || a.phone));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't make the links. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const tapped = (row: Row) => {
    setRows((rs) => rs && rs.map((r) => (r.token === row.token ? { ...r, tapped: true } : r)));
    // A web page can't tell whether the message went; opening it counts.
    Parse.Cloud.run("markTextInvite", { token: row.token, status: "sent" }).catch(() => {});
  };

  if (!calendar) return null;
  const sentCount = rows?.filter((r) => r.tapped).length ?? 0;
  const nativeHref = `leaf://text-friends/${calendar.objectId}${planId ? `?plan=${planId}` : ""}`;

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">Invite friends</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Text people from your own phone or Mac, one at a time, each with their own link. Leaf tells you who opens it and who
          {planId ? " RSVPs" : " follows"}.
        </p>
      </div>

      {/* What they're invited to */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Calendar</span>
          <select
            value={calendar.objectId}
            disabled={rows !== null}
            onChange={(e) => { setCalendarId(e.target.value); onCalendarChange?.(e.target.value); setPlanId(""); reset(); }}
            className="mt-1.5 w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm bg-white disabled:bg-zinc-50"
          >
            {calendars.map((c) => <option key={c.objectId} value={c.objectId}>{c.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Invite them to</span>
          <select
            value={planId}
            disabled={rows !== null}
            onChange={(e) => { setPlanId(e.target.value); reset(); }}
            className="mt-1.5 w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm bg-white disabled:bg-zinc-50"
          >
            <option value="">Follow the calendar</option>
            {plans.map((p) => (
              <option key={p.objectId} value={p.objectId}>
                {p.title} · {new Date(p.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              </option>
            ))}
          </select>
        </label>
      </div>

      {nativeText && rows === null && (
        <a
          href={nativeHref}
          className="flex items-center justify-between gap-3 border border-zinc-200 rounded-xl px-4 py-3 hover:bg-zinc-50"
        >
          <span>
            <span className="block text-sm font-medium text-zinc-900">Pick from your contacts</span>
            <span className="block text-xs text-zinc-500">Search your contacts and text each one in Messages.</span>
          </span>
          <MessageCircle className="w-4 h-4 text-zinc-500 shrink-0" />
        </a>
      )}

      {rows === null ? (
        <div className="space-y-3">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              {nativeText ? "Or paste names and numbers" : "Names and numbers"}
            </span>
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={6}
              placeholder={"Dana Kim 917-555-0101\nSam +1 (646) 555-0199"}
              className="mt-1.5 w-full border border-zinc-200 rounded-lg p-3 text-sm focus:outline-none focus:border-zinc-900 font-mono"
            />
          </label>
          <p className="text-xs text-zinc-500">
            One person per line. {parsed.length > 0 ? `${parsed.length} ${parsed.length === 1 ? "number" : "numbers"} found.` : ""}
            {parsed.length > 50 ? " Up to 50 at a time." : ""}
          </p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            onClick={makeLinks}
            disabled={busy || parsed.length === 0}
            className="px-5 py-2.5 bg-zinc-900 text-white rounded-full text-sm font-medium hover:bg-zinc-800 disabled:opacity-40"
          >
            {busy ? "Making links…" : parsed.length === 0 ? "Make links" : `Make ${parsed.length} ${parsed.length === 1 ? "link" : "links"}`}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Your message</span>
            <textarea
              value={template ?? defaultTemplate}
              onChange={(e) => setTemplate(e.target.value)}
              rows={3}
              className="mt-1.5 w-full border border-zinc-200 rounded-lg p-3 text-sm focus:outline-none focus:border-zinc-900"
            />
            <span className="text-xs text-zinc-500">{"{first}"} becomes each friend&apos;s first name, {"{link}"} their own link.</span>
          </label>

          {already.length > 0 && (
            <p className="text-xs text-zinc-500">
              {planId ? "Already going" : "Already following"}, so left out: {already.join(", ")}.
            </p>
          )}

          {rows.length === 0 ? (
            <p className="text-sm text-zinc-600">Everyone on your list is already in. There&apos;s no one new to text.</p>
          ) : (
            <>
              <p className="text-xs text-zinc-500">
                {sentCount} of {rows.length} opened in Messages. Tap Text, send it, then come back for the next.
              </p>
              <ul className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl">
                {rows.map((r) => (
                  <li key={r.token} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-sm text-zinc-900">{r.name || r.phone}</span>
                      {r.textedAt && !r.tapped && (
                        <span className="block text-[11px] text-amber-700">
                          Texted {new Date(r.textedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </span>
                    <a
                      href={smsHref(r.phone, fill(template ?? defaultTemplate, r))}
                      onClick={() => tapped(r)}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium ${
                        r.tapped ? "border border-zinc-200 text-zinc-600" : "bg-zinc-900 text-white hover:bg-zinc-800"
                      }`}
                    >
                      {r.tapped ? <><Check className="w-3.5 h-3.5" /> Texted</> : "Text"}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button
            onClick={() => { reset(); setPasted(""); }}
            className="text-xs text-zinc-500 hover:text-zinc-900"
          >
            Invite more people
          </button>
        </div>
      )}
    </div>
  );
}
