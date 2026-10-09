"use client";

import { useCallback, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Clock,
  Lock,
  MapPin,
  MessageSquare,
  Plus,
  Send,
  Share2,
} from "lucide-react";
import Parse from "@/lib/parse-client";
import { renderLinkedText } from "@/lib/linkify";
import HostIntroVideoCard, { type IntroVideoInfo } from "@/components/HostIntroVideoCard";
import FriendInviteCard from "@/components/FriendInviteCard";

/** The checklist row that opens into the recorder (intro-video.js). */
const INTRO_TASK_KEY = "record_intro";
/** The row that is an editor for EventGroup.meetingSpot (host-task-functions.js). */
const MEETING_SPOT_TASK_KEY = "set_meeting_spot";
// "Invite one more person — it's just you so far" (server: drive_signups).
const INVITE_TASK_KEY = "drive_signups";
// "Ask your guests to bring a friend": a draft for the plan chat (server: bring_a_friend).
const BRING_FRIEND_TASK_KEY = "bring_a_friend";

export type HostTask = {
  id: string;
  key: string;
  title: string;
  detail: string | null;
  status: "pending" | "done" | "blocked" | "skipped";
  order: number;
  dueAt: string | null;
  opensAt: string | null;
  windowNote: string | null;
  /** The venue won't take this yet — not late, not actionable. */
  notYetPossible: boolean;
  overdue: boolean;
  /** A group message drafted for the host. Inert until they send it. */
  draftMessage: string | null;
  draftSentAt: string | null;
  /**
   * People who've turned up to this host's plans before, most-shared first.
   * Only ever set on the "you have nobody yet" task. Names only — this is the
   * co-attendance graph, which is mutual by construction, so it discloses
   * nothing either side doesn't already know.
   */
  suggestedInvites: { userId: string; name: string; shared: number }[] | null;
  /**
   * Work the host may ignore forever without it reading as unfinished. Rendered
   * apart from the list and kept out of the counter — the server already keeps
   * these out of the progress ring, and the page must agree with it or the two
   * surfaces disagree about whether the host is behind.
   */
  optional: boolean;
  /**
   * Present on the share row and the invite row. The row links out to the
   * share kit page (/t/<id>/share), which does the actual work; the rest is
   * there for iOS, which renders `detail` and nothing else.
   */
  sharePack: {
    shareKitUrl: string | null;
    shareUrl: string;
    caption: string;
    postImageUrl: string;
    storyImageUrl: string;
  } | null;
  /**
   * On the meeting-spot row only: what attendees see and the spot as it
   * stands. The row renders as an editor, and the server ticks it itself
   * when a spot is saved.
   */
  meetingSpot?: {
    current: string | null;
    venueName: string | null;
    venueAddress: string | null;
    venueHidden: boolean;
    maxLength: number;
    editUrl: string | null;
  } | null;
};

export type HostChecklist = {
  notificationId: string;
  planId: string;
  planTitle: string;
  calendarName: string | null;
  dateISO: string | null;
  cancelled: boolean;
  chatUrl?: string | null;
  /** The seat's share kit, independent of any row. */
  shareKitUrl?: string | null;
  /**
   * The recorder card behind the "record a hello" row: state, beats, the
   * venue rule. Null on roster-hosted plans (they record from the offer
   * page) and when video is off, in which case the row is not sent either.
   */
  introVideo?: IntroVideoInfo | null;
  /** Where exactly to meet, as it stands on the plan. */
  meetingSpot?: string | null;
  /** Add-on orders guests pay this host for directly (addon-purchase.js). */
  addonOrders?: AddonOrder[];
  tasks: HostTask[];
};

type AddonOrder = {
  orderId: string;
  status: "unpaid" | "claimed" | "paid";
  ref: string;
  totalCents: number;
  buyerName: string;
  method: "venmo" | "cashapp" | "paypal" | "zelle" | null;
  autoConfirmAt: string | null;
  items: { title: string; quantity: number; guestNote?: string | null }[];
};

const ADDON_METHOD: Record<string, string> = { venmo: "Venmo", cashapp: "Cash App", paypal: "PayPal", zelle: "Zelle" };

/**
 * Add-on orders on the host's checklist: who ordered what, and Confirm /
 * Not received once they say they've paid. The seat id in this page's link
 * is what authorizes the host, as it does for the rest of the checklist.
 */
function AddonOrders({ orders, notificationId, onChanged }: {
  orders: AddonOrder[];
  notificationId: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const act = async (fn: "confirmAddonOrder" | "markAddonOrderNotReceived", orderId: string) => {
    setBusy(orderId);
    setErr(null);
    try {
      await Parse.Cloud.run(fn, { orderId, notificationId });
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(null);
    }
  };
  const money = (c: number) => `$${(c / 100).toFixed(2).replace(/\.00$/, "")}`;
  const order = { claimed: 0, unpaid: 1, paid: 2 } as const;
  const sorted = [...orders].sort((a, b) => order[a.status] - order[b.status]);
  return (
    <section className="px-5 pt-5 pb-4 border-b border-zinc-100">
      <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Add-on orders</p>
      <p className="mt-1 text-[13px] text-zinc-500">Guests pay you directly. Confirm when the money arrives — look for the code in the note.</p>
      <ul className="mt-3 space-y-2">
        {sorted.map((o) => (
          <li key={o.orderId} className="rounded-lg border border-zinc-200 px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-zinc-900">
                  {o.buyerName} · {o.items.map((i) => `${i.quantity > 1 ? `${i.quantity} × ` : ""}${i.title}`).join(", ")}
                </p>
                {o.items.filter((i) => i.guestNote).map((i) => (
                  <p key={i.title} className="text-[13px] text-zinc-700">
                    {o.items.length > 1 ? `${i.title}: ` : ""}&ldquo;{i.guestNote}&rdquo;
                  </p>
                ))}
                <p className={`text-[12px] ${o.status === "claimed" ? "text-amber-700" : o.status === "paid" ? "text-emerald-700" : "text-zinc-500"}`}>
                  {o.status === "paid" ? `Paid ${money(o.totalCents)} ✓`
                    : o.status === "claimed" ? `Says they paid ${money(o.totalCents)}${o.method ? ` on ${ADDON_METHOD[o.method]}` : ""} · ${o.ref}`
                      : `Ordered · ${money(o.totalCents)} not paid yet`}
                </p>
              </div>
              {o.status !== "paid" ? (
                <button type="button" disabled={busy === o.orderId} onClick={() => act("confirmAddonOrder", o.orderId)}
                  className="shrink-0 rounded-full bg-zinc-900 px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50">
                  {o.status === "claimed" ? "Confirm" : "Mark paid"}
                </button>
              ) : null}
            </div>
            {o.status !== "unpaid" && (
              <button type="button" disabled={busy === o.orderId} onClick={() => act("markAddonOrderNotReceived", o.orderId)}
                className="mt-1 text-[12px] text-zinc-400 underline">Not received?</button>
            )}
          </li>
        ))}
      </ul>
      {err && <p className="mt-2 text-[12px] text-red-600">{err}</p>}
    </section>
  );
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatShort(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// The draft lives HERE, on the task that produced it — not on the Needs You
// card. A card is a one-tap nag the host scrolls past; a message to the whole
// group deserves reading before it goes. The card points at this page.
function DraftPanel({
  task,
  notificationId,
  onSent,
}: {
  task: HostTask;
  notificationId: string;
  onSent: (taskId: string, sentAt: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(task.draftMessage ?? "");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!task.draftMessage) return null;

  if (task.draftSentAt) {
    return (
      <p className="flex items-center gap-1.5 text-[12px] text-zinc-400 mt-2">
        <Check className="w-3 h-3" />
        Sent to the group
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 mt-2 text-[12px] font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-full px-2.5 py-1 transition-colors"
      >
        <MessageSquare className="w-3 h-3" />
        Message the group
      </button>
    );
  }

  async function send() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setErr(null);
    try {
      const res = (await Parse.Cloud.run("sendHostTaskDraft", {
        taskId: task.id,
        notificationId,
        text: body,
      })) as { sentAt: string };
      onSent(task.id, res.sentAt);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That didn't send.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="mt-2.5 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
        Goes to the group chat, from you
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={Math.min(8, Math.max(3, Math.ceil(text.length / 42)))}
        className="w-full text-[14px] leading-relaxed text-zinc-900 bg-white border border-zinc-200 rounded-lg p-2.5 outline-none focus:border-zinc-400 resize-none"
      />

      {err && <p className="text-[12px] text-amber-700 mt-2">{err}</p>}

      <div className="flex items-center gap-2 mt-2.5">
        <button
          type="button"
          onClick={send}
          disabled={sending || !text.trim()}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white bg-zinc-900 disabled:bg-zinc-300 rounded-lg px-3 py-1.5 transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
          {sending ? "Sending…" : "Send"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[13px] text-zinc-400 hover:text-zinc-600 px-2 py-1.5 ml-auto"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Row({
  task,
  busy,
  notificationId,
  planId,
  onToggle,
  onSent,
}: {
  task: HostTask;
  busy: boolean;
  notificationId: string;
  planId: string;
  onToggle: (t: HostTask) => void;
  onSent: (taskId: string, sentAt: string) => void;
}) {
  const done = task.status === "done";
  // The invite row's personal-text kit opens in place under the row.
  const [textKitOpen, setTextKitOpen] = useState(false);
  const isInviteRow = task.key === INVITE_TASK_KEY;

  // The distinction the whole assistant rests on: a task whose booking window
  // hasn't opened is not late, it's not yet possible. Showing it as an overdue
  // nag teaches the host that the warning means nothing.
  const locked = task.notYetPossible && !done;

  return (
    <li className="border-b border-zinc-100 last:border-b-0">
      <button
        type="button"
        disabled={busy || locked}
        onClick={() => onToggle(task)}
        aria-pressed={done}
        className={`w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors ${
          locked ? "cursor-default" : "hover:bg-zinc-50 active:bg-zinc-100"
        } disabled:opacity-100`}
      >
        <span
          aria-hidden="true"
          className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
            done
              ? "bg-zinc-900 border-zinc-900 text-white"
              : locked
                ? "border-zinc-200 bg-zinc-50 text-zinc-300"
                : "border-zinc-300 bg-white"
          }`}
        >
          {done && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
          {!done && locked && <Lock className="w-3 h-3" />}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={`block text-[15px] leading-snug ${
              done ? "text-zinc-400 line-through" : "text-zinc-900"
            }`}
          >
            {task.title}
          </span>

          {task.detail && !done && (
            <span className="block whitespace-pre-line text-[13px] text-zinc-500 mt-0.5 leading-relaxed">
              {renderLinkedText(task.detail, { hostOnly: true })}
            </span>
          )}

          {!done && locked && (
            <span className="inline-flex items-center gap-1 mt-1.5 text-[12px] font-medium text-zinc-500 bg-zinc-100 rounded-full px-2 py-0.5">
              <Clock className="w-3 h-3" />
              {task.windowNote ||
                `Opens ${formatShort(task.opensAt) ?? "later"}`}
            </span>
          )}

          {!done && !locked && task.overdue && (
            <span className="inline-flex items-center gap-1 mt-1.5 text-[12px] font-medium text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
              Past due
            </span>
          )}

          {!done && !locked && !task.overdue && task.dueAt && (
            <span className="block text-[12px] text-zinc-400 mt-1">
              by {formatShort(task.dueAt)}
            </span>
          )}

          {!done && task.suggestedInvites?.length ? (
            <span className="block text-[12px] text-zinc-500 mt-1.5 leading-relaxed">
              {task.suggestedInvites.map((p) => p.name).join(", ")}{" "}
              {task.suggestedInvites.length === 1 ? "has" : "have"} come to your
              plans before.
            </span>
          ) : null}
        </span>
      </button>

      {/* Sibling of the button, never a child — a textarea and its send button
          cannot live inside another button. Indented to line up with the task
          text rather than the checkbox. */}
      {task.draftMessage && (
        <div className="pl-12 pr-4 pb-3 -mt-1">
          <DraftPanel
            task={task}
            notificationId={notificationId}
            onSent={onSent}
          />
        </div>
      )}

      {/* The kit is its own page: a preview, the caption, and one-tap targets
          need more room than a row. Nothing posts from Leaf either way. */}
      {/* The invite row also offers a personal text (cloud/plan-invites.js):
          one friend, one link, sent from the host's own phone — the row ticks
          itself off when that friend RSVPs. */}
      {!done && (task.sharePack?.shareKitUrl || isInviteRow) && (
        <div className="pl-12 pr-4 pb-3 -mt-1">
          <div className="flex flex-wrap gap-2">
            {isInviteRow && (
              <button
                type="button"
                onClick={() => setTextKitOpen((o) => !o)}
                aria-expanded={textKitOpen}
                className="inline-flex items-center gap-1.5 mt-2 text-[13px] font-medium text-white bg-zinc-900 rounded-lg px-3 py-1.5 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Send invites
              </button>
            )}
            {task.sharePack?.shareKitUrl && (
              <a
                href={task.sharePack.shareKitUrl}
                className={`inline-flex items-center gap-1.5 mt-2 text-[13px] font-medium rounded-lg px-3 py-1.5 transition-colors ${
                  isInviteRow ? "text-zinc-900 bg-zinc-100 hover:bg-zinc-200" : "text-white bg-zinc-900"
                }`}
              >
                <Share2 className="w-3.5 h-3.5" />
                Open the share kit
              </a>
            )}
          </div>
          {isInviteRow && textKitOpen && (
            <div className="mt-3">
              <FriendInviteCard
                eventGroupId={planId}
                variant="host"
                hostNotificationId={notificationId}
                suggestions={task.suggestedInvites?.map((p) => p.name)}
                bare
              />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * The hello row. Not a checkbox: the card IS the task, and the server ticks
 * the row itself when the clip goes live (and unticks it on removal), so
 * the host never has to claim they did it. Shown in the Done section too,
 * where the card is the live take with "record another".
 */
function IntroRow({
  task,
  video,
  notificationId,
  onChanged,
}: {
  task: HostTask;
  video: IntroVideoInfo;
  notificationId: string;
  onChanged: () => Promise<unknown>;
}) {
  return (
    <li className="border-b border-zinc-100 last:border-b-0 px-4 py-3.5">
      <p className="text-[15px] leading-snug text-zinc-900">{task.title}</p>
      {task.status !== "done" && task.detail && (
        <p className="block whitespace-pre-line text-[13px] text-zinc-500 mt-0.5 leading-relaxed">{task.detail}</p>
      )}
      <div className="mt-3">
        <HostIntroVideoCard
          source={{ kind: "checklist", notificationId }}
          video={video}
          timeZone={null}
          planStarted={video.planStarted === true}
          onChanged={onChanged}
          embedded
        />
      </div>
    </li>
  );
}

/**
 * The meeting-spot row: the one place the checklist says what attendees
 * actually see. Not a checkbox — saving the spot is what ticks it, and the
 * server does that, so the host never claims work the plan can't show. Stays
 * in Done as the spot with an Edit, because a wrong spot is worse than none.
 */
function MeetingSpotRow({
  task,
  notificationId,
  onSaved,
}: {
  task: HostTask;
  notificationId: string;
  onSaved: (task: HostTask, meetingSpot: string | null) => void;
}) {
  const pack = task.meetingSpot;
  const done = task.status === "done";
  const [editing, setEditing] = useState(!done);
  const [text, setText] = useState(pack?.current ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const max = pack?.maxLength ?? 300;
  const shown = pack
    ? [pack.venueName, pack.venueAddress].filter(Boolean).join(", ")
    : "";

  async function save(next: string) {
    setSaving(true);
    setErr(null);
    try {
      const res = (await Parse.Cloud.run("setPlanMeetingSpot", {
        notificationId,
        meetingSpot: next,
      })) as { meetingSpot: string | null; task: HostTask | null };
      onSaved(res.task ?? { ...task, status: res.meetingSpot ? "done" : "pending" }, res.meetingSpot);
      setText(res.meetingSpot ?? "");
      setEditing(!res.meetingSpot);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That didn't save. Try again?");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li id="meeting-spot" className="border-b border-zinc-100 last:border-b-0 px-4 py-3.5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
            done ? "bg-zinc-900 border-zinc-900 text-white" : "border-zinc-300 bg-white"
          }`}
        >
          {done && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-[15px] leading-snug ${done ? "text-zinc-500" : "text-zinc-900"}`}>{task.title}</p>
          {!done && task.detail && (
            <p className="whitespace-pre-line text-[13px] text-zinc-500 mt-0.5 leading-relaxed">{task.detail}</p>
          )}

          {pack && shown && (
            <div className="mt-2.5 rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                What people who RSVP see
              </p>
              <p className="mt-1 flex items-start gap-1.5 text-[14px] text-zinc-800">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-zinc-400" />
                <span>
                  {shown}
                  {pack.current && !editing ? (
                    <span className="block text-zinc-900 font-medium">Meet at: {pack.current}</span>
                  ) : (
                    <span className="block text-zinc-400 italic">No meeting spot yet</span>
                  )}
                </span>
              </p>
              {pack.venueHidden && (
                <p className="mt-1.5 flex items-center gap-1 text-[12px] text-zinc-400">
                  <Lock className="w-3 h-3" /> Shown only after someone RSVPs
                </p>
              )}
            </div>
          )}

          {editing ? (
            <div className="mt-2.5">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, max))}
                rows={2}
                maxLength={max}
                placeholder={
                  pack?.venueName
                    ? `e.g. the W 59th St entrance by Columbus Circle — I'll be in a beige jacket`
                    : "Where exactly to find you"
                }
                aria-label="Exact meeting spot"
                className="w-full text-[14px] leading-relaxed text-zinc-900 bg-white border border-zinc-200 rounded-lg p-2.5 outline-none focus:border-zinc-400 resize-none"
              />
              {err && <p className="text-[12px] text-amber-700 mt-1.5">{err}</p>}
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => save(text.trim())}
                  disabled={saving || !text.trim()}
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white bg-zinc-900 disabled:bg-zinc-300 rounded-lg px-3 py-1.5 transition-colors"
                >
                  {saving ? "Saving…" : "Save meeting spot"}
                </button>
                {pack?.current && (
                  <button
                    type="button"
                    onClick={() => {
                      setText(pack.current ?? "");
                      setEditing(false);
                    }}
                    className="text-[13px] text-zinc-400 hover:text-zinc-600 px-2 py-1.5 ml-auto"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 mt-2">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-[13px] font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-full px-2.5 py-1 transition-colors"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => save("")}
                disabled={saving}
                className="text-[13px] text-zinc-400 hover:text-zinc-600 px-1 py-1"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export default function ChecklistClient({
  notificationId,
  initial,
  initialError,
  hello = false,
}: {
  notificationId: string;
  initial: HostChecklist | null;
  initialError: string | null;
  /** Lead with the 30-second hello: the host has just accepted or been
   *  approved and the link they tapped said so. */
  hello?: boolean;
}) {
  const [data, setData] = useState<HostChecklist | null>(initial);
  const [error, setError] = useState<string | null>(initialError);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  // The recorder card re-reads the whole list after an upload or removal:
  // the server moves the hello row between open and done itself.
  const refresh = useCallback(async () => {
    try {
      const fresh = (await Parse.Cloud.run("getHostChecklist", { notificationId })) as HostChecklist;
      setData(fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't refresh the list.");
    }
  }, [notificationId]);

  // The hello leads the page when the host arrives from an accept/approve
  // link and has not recorded one yet; the row then stays out of the list
  // below so it is not asked twice. Once a take is up, the page is the
  // ordinary list and the row sits in Done.
  const leadWithHello = Boolean(
    hello && data?.introVideo && data.introVideo.available
      && data.introVideo.status !== "ready" && data.introVideo.status !== "processing" && !data.cancelled,
  );

  // The spot row swaps itself between open and done on save — the server
  // moved the row, and this mirrors it without a refetch.
  const onSpotSaved = useCallback((task: HostTask, meetingSpot: string | null) => {
    setData((d) =>
      d
        ? {
            ...d,
            meetingSpot,
            tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, ...task } : t)),
          }
        : d,
    );
  }, []);

  const renderRow = (t: HostTask) =>
    t.key === INTRO_TASK_KEY && data?.introVideo ? (
      <IntroRow key={t.id} task={t} video={data.introVideo} notificationId={notificationId} onChanged={refresh} />
    ) : t.key === MEETING_SPOT_TASK_KEY && t.meetingSpot ? (
      <MeetingSpotRow key={t.id} task={t} notificationId={notificationId} onSaved={onSpotSaved} />
    ) : (
      <Row
        key={t.id}
        task={t}
        busy={busyId === t.id}
        notificationId={notificationId}
        planId={data?.planId ?? ""}
        onToggle={toggle}
        onSent={markSent}
      />
    );

  const tasks = data?.tasks ?? [];
  // `open` is the count; `listed` is what renders. An optional row is in the
  // list where the server ordered it (the share row sits second, order 0.5)
  // but never in the count at the top, which would read as work outstanding
  // — the server keeps these out of the progress ring for the same reason,
  // and the two surfaces have to agree about whether the host is behind.
  // Ticking one still sends it to Done, which is the whole reward.
  const { open, listed, done } = useMemo(
    () => ({
      open: tasks.filter((t) => t.status !== "done" && !t.optional),
      listed: tasks.filter((t) => t.status !== "done"),
      done: tasks.filter((t) => t.status === "done"),
    }),
    [tasks],
  );

  const actionable = open.filter((t) => !t.notYetPossible).length;

  const toggle = useCallback(
    async (task: HostTask) => {
      if (!data) return;
      const next = task.status === "done" ? "pending" : "done";

      // Optimistic — a checkbox that waits on a round trip feels broken on a
      // phone. Rolled back below if the write fails.
      const before = data;
      setData({
        ...data,
        tasks: data.tasks.map((t) =>
          t.id === task.id ? { ...t, status: next } : t,
        ),
      });
      setBusyId(task.id);
      try {
        await Parse.Cloud.run("setHostTaskStatus", {
          taskId: task.id,
          status: next,
          notificationId,
        });
      } catch (e) {
        setData(before);
        setError(
          e instanceof Error ? e.message : "That didn't save. Try again?",
        );
      } finally {
        setBusyId(null);
      }
    },
    [data, notificationId],
  );

  const markSent = useCallback(
    (taskId: string, sentAt: string) => {
      setData((d) =>
        d
          ? {
              ...d,
              tasks: d.tasks.map((t) =>
                t.id !== taskId
                  ? t
                  // The bring-a-friend message is the task: the server ticks
                  // the row on send, and the page mirrors it without a refetch.
                  : t.key === BRING_FRIEND_TASK_KEY
                    ? { ...t, draftSentAt: sentAt, status: "done" }
                    : { ...t, draftSentAt: sentAt },
              ),
            }
          : d,
      );
    },
    [],
  );

  const addTask = useCallback(async () => {
    const title = draft.trim();
    if (!title || !data) return;
    setAdding(true);
    try {
      const res = (await Parse.Cloud.run("addHostTask", {
        notificationId,
        title,
      })) as { task: HostTask };
      setData({ ...data, tasks: [...data.tasks, res.task] });
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that.");
    } finally {
      setAdding(false);
    }
  }, [draft, data, notificationId]);

  if (!data) {
    return (
      <main className="min-h-dvh bg-zinc-50 flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h1 className="text-lg font-semibold text-zinc-900">
            We couldn&rsquo;t open this checklist
          </h1>
          <p className="text-sm text-zinc-500 mt-2">
            {error || "The link may have expired."}
          </p>
        </div>
      </main>
    );
  }

  const dateLabel = formatDate(data.dateISO);

  return (
    <main className="min-h-dvh bg-zinc-50">
      <div className="mx-auto w-full max-w-lg bg-white min-h-dvh sm:min-h-0 sm:my-8 sm:rounded-2xl sm:shadow-sm sm:border sm:border-zinc-200 overflow-hidden">
        <header className="px-5 pt-6 pb-5 border-b border-zinc-100">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
            Your checklist
          </p>
          <h1 className="text-xl font-semibold text-zinc-900 mt-1.5 leading-snug text-balance">
            {data.planTitle}
          </h1>
          {dateLabel && (
            <p className="flex items-center gap-1.5 text-sm text-zinc-500 mt-2">
              <CalendarDays className="w-4 h-4" />
              {dateLabel}
              {data.calendarName ? ` · ${data.calendarName}` : ""}
            </p>
          )}
          {!data.cancelled && (
            <p className="text-sm text-zinc-600 mt-3">
              {actionable === 0
                ? open.length > 0
                  ? "Nothing to do yet — we'll text you when the venue opens up."
                  : "All done. Nothing left before the day."
                : `${actionable} thing${actionable === 1 ? "" : "s"} to sort.`}
            </p>
          )}
          {!data.cancelled && data.chatUrl && (
            <a
              href={data.chatUrl}
              className="inline-flex items-center gap-1.5 mt-3 text-[13px] font-medium text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-full px-3 py-1.5 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Open the group chat
            </a>
          )}
        </header>

        {data.cancelled && (
          <div className="mx-5 mt-4 text-sm bg-red-50 text-red-700 rounded-lg px-3 py-2">
            This plan was cancelled.
          </div>
        )}

        {error && (
          <div className="mx-5 mt-4 text-sm bg-amber-50 text-amber-800 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {leadWithHello && data.introVideo && (
          <section className="px-5 pt-5 pb-4 border-b border-zinc-100 bg-leaf-50/40">
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">First, a hello</p>
            <p className="mt-1.5 text-[15px] leading-snug text-zinc-900">
              You&rsquo;re hosting. A 30-second hello to camera goes on the plan page next to your name — people RSVP to a face.
            </p>
            <div className="mt-3">
              <HostIntroVideoCard
                source={{ kind: "checklist", notificationId }}
                video={data.introVideo}
                timeZone={null}
                planStarted={data.introVideo.planStarted === true}
                onChanged={refresh}
                embedded
              />
            </div>
          </section>
        )}

        {!data.cancelled && (data.addonOrders?.length ?? 0) > 0 && (
          <AddonOrders orders={data.addonOrders!} notificationId={notificationId} onChanged={refresh} />
        )}

        {/* Direct invites, in the assigned host's own voice. The checklist link
            is their credential (no session), as for the rest of this page. */}
        {/* Hidden while the open invite row carries the same kit as a pill. */}
        {!data.cancelled && (!data.dateISO || new Date(data.dateISO).getTime() > Date.now())
          && !listed.some((t) => t.key === INVITE_TASK_KEY && t.status !== "done") && (
          <section className="px-5 pt-5 pb-4 border-b border-zinc-100">
            <FriendInviteCard eventGroupId={data.planId} variant="host" hostNotificationId={notificationId} />
          </section>
        )}

        <ul className="mt-1">
          {listed.filter((t) => !(leadWithHello && t.key === INTRO_TASK_KEY)).map(renderRow)}
        </ul>

        <div className="px-4 py-3 border-t border-zinc-100">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-zinc-400 shrink-0" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTask();
              }}
              placeholder="Add your own"
              aria-label="Add your own task"
              className="flex-1 text-[15px] text-zinc-900 placeholder:text-zinc-400 bg-transparent outline-none py-1"
            />
            {draft.trim() && (
              <button
                type="button"
                onClick={addTask}
                disabled={adding}
                className="text-sm font-medium text-zinc-900 disabled:text-zinc-400 px-2 py-1"
              >
                Add
              </button>
            )}
          </div>
        </div>

        {done.length > 0 && (
          <section className="border-t border-zinc-100">
            <h2 className="px-5 pt-5 pb-1 text-[11px] font-bold uppercase tracking-widest text-zinc-400">
              Done
            </h2>
            <ul>
              {done.map(renderRow)}
            </ul>
          </section>
        )}

        <footer className="px-5 py-6 text-center">
          <p className="text-[12px] text-zinc-400">
            Leaf keeps this list for you. Nobody else sees it.
          </p>
        </footer>
      </div>
    </main>
  );
}
