"use client";

/**
 * The host link landing — /org/<calendar>?host=<token>.
 *
 * An owner posted someone's event and sent them this link
 * (CopyHostLinkButton). They see the plan as posted, can rewrite the
 * description in their own words, verify a phone, and tap Host it: the plan
 * goes live on the calendar with them as host (leaflets-server
 * idea-host-invite.js acceptIdeaHostLink). Date, time and place stay as the
 * owner set them.
 *
 * The same link can hand over a plan that's already live (Change host in
 * the plan view, createPlanHostLink): then Host it makes them the host of
 * that plan, guests and all.
 *
 * Every dead link renders a sentence, not an error.
 */

import { useEffect, useState, type ComponentType } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import Parse from "@/lib/parse-client";
import { usePhoneVerify } from "@/components/ContactStep";

type LinkInfo =
  | { state: "gone" }
  | { state: "closed"; title: string; calendarName: string | null }
  | {
    state: "taken";
    title: string;
    calendarName: string | null;
    mine: boolean;
    hostName: string | null;
    eventGroupId: string | null;
    /** The live plan's description, for the host to edit. */
    description: string | null;
  }
  | {
    state: "open";
    /** "plan": a live plan changing hands, not an idea going live. */
    kind?: "plan";
    ideaId: string | null;
    title: string;
    calendarName: string | null;
    description: string;
    startsAt: string | null;
    timeZone: string | null;
    /** Sent for a live plan, which isn't in the page's idea list. */
    imageUrl?: string | null;
    place?: string | null;
  };

function whenLabel(iso: string | null, tz: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const opts = tz ? { timeZone: tz } : {};
  const day = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", ...opts });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", ...opts });
  return `${day} · ${time}`;
}

export default function HostLinkSheet({
  token,
  image,
  place,
  PhoneFields,
  onClose,
}: {
  token: string;
  /** From the calendar's own idea list, when the page has it. */
  image: (ideaId: string) => string | null;
  place: (ideaId: string) => string | null;
  PhoneFields: ComponentType<{ verify: ReturnType<typeof usePhoneVerify> }>;
  onClose: () => void;
}) {
  const verify = usePhoneVerify({ requireSession: true });
  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hosted, setHosted] = useState<{ eventGroupId: string | null } | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  // Reloaded once a phone is verified: the same link then reads as theirs.
  useEffect(() => {
    setSignedIn(!!Parse.User.current());
    Parse.Cloud.run("getIdeaHostLink", { token })
      .then((r: unknown) => {
        const next = r as LinkInfo;
        setInfo(next);
        if (next.state === "open") setDescription(next.description || "");
      })
      .catch(() => setInfo({ state: "gone" }));
  }, [token, verify.isVerified]);

  useEffect(() => {
    if (verify.isVerified) setSignedIn(true);
  }, [verify.isVerified]);

  async function host() {
    if (!info || info.state !== "open" || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = (await Parse.Cloud.run("acceptIdeaHostLink", { token, description })) as {
        eventGroupId: string | null;
      };
      setHosted({ eventGroupId: r.eventGroupId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t make you the host — try again.");
    } finally {
      setBusy(false);
    }
  }

  const open = info && info.state === "open" ? info : null;
  const ideaId = open ? open.ideaId : null;
  const isPlan = open?.kind === "plan";
  const img = (ideaId ? image(ideaId) : null) || open?.imageUrl || null;
  const where = (ideaId ? place(ideaId) : null) || open?.place || null;
  // Desktop: the poster on the left, the form beside it.
  const wide = !!img && !hosted;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-0 md:p-4 bg-zinc-900/60 backdrop-blur-sm"
      onClick={() => { if (!busy) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`bg-white w-full max-w-md ${wide ? "md:max-w-4xl md:overflow-hidden" : ""} max-h-[92vh] overflow-y-auto shadow-2xl rounded-t-3xl md:rounded-2xl relative`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={() => { if (!busy) onClose(); }}
          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-white/80 text-zinc-500 hover:text-zinc-900"
        >
          <X className="w-5 h-5" />
        </button>

        {!info ? (
          <div className="p-10 flex items-center justify-center gap-2 text-sm text-zinc-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : hosted ? (
          <Hosting
            fresh
            handedOver={isPlan}
            title={info.state === "open" ? info.title : "this"}
            calendarName={info.state === "open" ? info.calendarName : null}
            eventGroupId={hosted.eventGroupId}
            initialDescription={description}
          />
        ) : info.state === "gone" ? (
          <Notice title="This host link no longer works" body="Ask whoever sent it for a new one." />
        ) : info.state === "closed" ? (
          <Notice title={info.title} body="This one already has a host or starts too soon to take on." />
        ) : info.state === "taken" ? (
          info.mine ? (
            <Hosting
              title={info.title}
              calendarName={info.calendarName}
              eventGroupId={info.eventGroupId}
              initialDescription={info.description ?? ""}
            />
          ) : (
            <>
              <Notice
                title={info.title}
                body={`${info.hostName ? `${info.hostName} is` : "Someone else is"} already hosting this one.`}
              />
              {!signedIn && (
                <div className="px-8 md:px-10 pb-8 space-y-2">
                  <p className="text-xs text-zinc-500">Is that you? Verify your phone to edit your plan.</p>
                  <PhoneFields verify={verify} />
                </div>
              )}
            </>
          )
        ) : (
          <div className={wide ? "md:grid md:grid-cols-2 md:h-[min(92vh,720px)]" : ""}>
            {img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={img}
                alt=""
                referrerPolicy="no-referrer"
                className="w-full h-40 md:h-full object-cover rounded-t-3xl md:rounded-none bg-zinc-100"
              />
            )}
            <div className={`p-6 md:p-8 space-y-5 ${wide ? "md:overflow-y-auto" : ""}`}>
              <div className="space-y-1.5 pr-8">
                <p className="text-[11px] tracking-wider uppercase font-bold text-emerald-700">
                  You&rsquo;re invited to host
                </p>
                <h3 className="text-2xl font-light tracking-tight">{info.title}</h3>
                <p className="text-sm text-zinc-500">
                  {[whenLabel(info.startsAt, info.timeZone), where].filter(Boolean).join(" · ")}
                </p>
                {info.calendarName && (
                  <p className="text-sm text-zinc-500">On {info.calendarName}</p>
                )}
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs tracking-wider uppercase font-bold">Description</span>
                <span className="block text-xs text-zinc-500">Say it in your own words. This is what guests read.</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  maxLength={4000}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm leading-relaxed focus:outline-none focus:border-zinc-900"
                />
              </label>

              {!signedIn && (
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500">Verify your phone so guests&rsquo; RSVPs reach you.</p>
                  <PhoneFields verify={verify} />
                </div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="button"
                onClick={host}
                disabled={busy || !signedIn}
                className="w-full py-3.5 rounded-xl bg-zinc-900 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                Host it
              </button>
              <p className="text-xs text-zinc-400 text-center">
                {isPlan
                  ? "You take over as host right away. Anyone who already RSVP\u2019d stays on, and the date, time and place stay as posted."
                  : "It goes live on the calendar right away. The date, time and place stay as posted."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// The host's view once the plan is theirs: just after Host it, or reopening
// the link later. The description stays editable (updatePlanDetails lets a
// plan's host change it); date, time and place stay as posted.
function Hosting({
  fresh = false,
  handedOver = false,
  title,
  calendarName,
  eventGroupId,
  initialDescription,
}: {
  fresh?: boolean;
  /** A live plan they took over, rather than an idea they put live. */
  handedOver?: boolean;
  title: string;
  calendarName: string | null;
  eventGroupId: string | null;
  initialDescription: string;
}) {
  const [text, setText] = useState(initialDescription);
  const [saved, setSaved] = useState(initialDescription);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const dirty = text.trim() !== saved.trim();

  async function save() {
    if (!eventGroupId || !dirty || saving) return;
    setSaving(true);
    setNote(null);
    try {
      await Parse.Cloud.run("updatePlanDetails", { eventGroupId, description: text.trim() });
      setSaved(text.trim());
      setNote("Saved");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Couldn’t save — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 md:p-8 space-y-5">
      <div className="space-y-2 pr-8">
        {fresh && <CheckCircle2 className="w-10 h-10 text-emerald-600" />}
        <h3 className="text-2xl font-light tracking-tight">You&rsquo;re hosting {title}</h3>
        <p className="text-sm text-zinc-500">
          {fresh
            ? handedOver
              ? `It’s yours now on ${calendarName || "the calendar"}. RSVPs reach you from here. Open this link again any time to edit the description.`
              : `It’s live on ${calendarName || "the calendar"}. Followers can see it and RSVP. Open this link again any time to edit the description.`
            : "Edit the description guests read. The date, time and place stay as posted."}
        </p>
      </div>
      {eventGroupId && (
        <label className="block space-y-1.5">
          <span className="text-xs tracking-wider uppercase font-bold">Description</span>
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setNote(null); }}
            rows={5}
            maxLength={4000}
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm leading-relaxed focus:outline-none focus:border-zinc-900"
          />
          <span className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="px-4 py-2 rounded-lg border border-zinc-300 text-sm font-medium disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save description"}
            </button>
            {note && <span className="text-xs text-zinc-500">{note}</span>}
          </span>
        </label>
      )}
      {eventGroupId && (
        <a
          href={`/p/${eventGroupId}`}
          className="block w-full py-3 rounded-xl bg-zinc-900 text-white text-sm font-medium text-center"
        >
          See your plan
        </a>
      )}
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="p-8 md:p-10 space-y-2 pr-12">
      <h3 className="text-xl font-light">{title}</h3>
      <p className="text-sm text-zinc-500">{body}</p>
    </div>
  );
}
