"use client";

/**
 * The host board — /hosts/board?t=<link>
 *
 * Open plans, what each pays, and an Apply button. Hosts apply to as many as
 * they like; Leaf picks, and the host then gets the usual offer page to say
 * yes. A host holds one plan at a time, so while they have one the board is
 * read-only and says when it frees up.
 *
 * Deliberately NOT here: the venue (released with the offer), who else
 * applied, or any ranking. Dead links read as a sentence, not an error.
 */

import { useCallback, useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import PitchSection, { type Pitch, type PitchOption } from "./PitchSection";

type BoardRow = {
  key: string;
  kind: "plan" | "idea" | "aiEvent";
  subjectId: string;
  title: string;
  calendarName: string | null;
  startsAt: string;
  whenLabel: string;
  neighborhoods: string[];
  interestedCount: number;
  rateLabel: string;
  priceLabel?: string;
  /** The plan's own picture; null when it has none (the Leaf mark stands in). */
  imageUrl?: string | null;
  /** A short teaser from the plan's description. */
  blurb?: string | null;
  applied: boolean;
};

type Application = {
  applicationId: string;
  key: string | null;
  title: string | null;
  whenLabel: string | null;
  neighborhoods: string[];
};

type Board = {
  state: "ok" | "unavailable";
  host?: { firstName: string | null; tier: "new" | "returning"; neighborhoods: string[] };
  nearCount?: number;
  payTerms?: string;
  openJob?: { title: string; whenLabel: string } | null;
  rows?: BoardRow[];
  applications?: Application[];
  /** Neighborhoods this host may pitch their own event in. */
  pitchOptions?: PitchOption[];
  pitches?: Pitch[];
};

const STORAGE_KEY = "leaf.hostBoardToken";

const card = "rounded-2xl border border-zinc-200 bg-white p-5";
const btnPrimary =
  "rounded-lg bg-leaf-800 px-4 py-2.5 text-[15px] font-medium text-white " +
  "transition-colors hover:bg-leaf-900 disabled:opacity-50";
const btnQuiet =
  "rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-[15px] " +
  "font-medium text-leaf-900 transition-colors hover:border-zinc-400 disabled:opacity-50";
const btnSmallPrimary =
  "shrink-0 rounded-lg bg-leaf-800 px-3.5 py-2 text-[14px] font-medium text-white " +
  "transition-colors hover:bg-leaf-900 disabled:opacity-50";
const btnSmallQuiet =
  "shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[14px] " +
  "font-medium text-leaf-900 transition-colors hover:border-zinc-400 disabled:opacity-50";
const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-[16px] " +
  "text-leaf-900 placeholder:text-zinc-400 outline-none " +
  "focus:border-leaf-600 focus:ring-2 focus:ring-leaf-600/20";

function Shell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  // The board itself is a grid and uses the width; the small screens around
  // it (get a link, not available) stay a readable single column.
  return (
    <main className={`mx-auto w-full min-w-0 px-5 py-10 pb-24 ${wide ? "max-w-6xl" : "max-w-lg"}`}>{children}</main>
  );
}

// The top of the board: what a host does, what happens next, and how pay
// works. Matches the server's PAY_TERMS (host-marketplace-helpers.js).
const HOW_IT_WORKS = [
  {
    title: "Apply to the plans you want",
    body: "Pick as many as you like. You host one at a time.",
  },
  {
    title: "We pick a host",
    body: "If it's you, we email the details and you confirm.",
  },
  {
    title: "Get paid the amount shown",
    body: "Once people RSVP and you've hosted. No RSVPs 3 hours before, it's called off and not paid.",
  },
];

// Plans without a picture get a colour from this set, picked by the plan's
// key so a plan keeps its colour between visits. Leaf's greens plus two warm
// accents, all dark enough for white text.
const PLACEHOLDER_GRADIENTS = [
  "linear-gradient(135deg, #2f6b4f, #1a2924)",
  "linear-gradient(135deg, #3f7d6a, #1f4a3d)",
  "linear-gradient(135deg, #5b7f3a, #2c4a1f)",
  "linear-gradient(135deg, #2b6777, #173b47)",
  "linear-gradient(135deg, #a55a2a, #5e2f14)",
  "linear-gradient(135deg, #7a4d7d, #3e2442)",
];

function placeholderGradient(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PLACEHOLDER_GRADIENTS[h % PLACEHOLDER_GRADIENTS.length];
}

/**
 * One plan: picture, the facts, a teaser, then price and the action on one
 * line. `featured` is the plan picked from the email: full width, picture
 * beside the text on larger screens, and more of the description.
 */
function PlanCard({
  row,
  application,
  busy,
  disabled,
  onApply,
  onWithdraw,
  featured = false,
}: {
  row: BoardRow;
  application: Application | undefined;
  busy: boolean;
  disabled: boolean;
  onApply: () => void;
  onWithdraw: (applicationId: string) => void;
  featured?: boolean;
}) {
  const place = [row.neighborhoods.slice(0, 2).join(", "), row.calendarName].filter(Boolean).join(" · ");
  return (
    <article
      className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-white ${
        featured ? "border-leaf-300 shadow-sm sm:flex-row" : "border-zinc-200"
      }`}
    >
      <div
        className={`relative w-full overflow-hidden bg-leaf-50 ${
          featured ? "aspect-[5/2] sm:aspect-auto sm:min-h-[240px] sm:w-2/5 sm:shrink-0" : "aspect-[5/2] sm:aspect-[2/1]"
        }`}
      >
        {row.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div
            className="absolute inset-0 flex items-end p-4"
            style={{ background: placeholderGradient(row.key) }}
          >
            <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-white/95 drop-shadow-sm">
              {row.title}
            </span>
          </div>
        )}
      </div>
      <div className={`flex min-w-0 flex-1 flex-col ${featured ? "p-5 sm:p-6" : "p-4"}`}>
        <h2
          className={`line-clamp-2 font-semibold leading-snug text-leaf-900 ${
            featured ? "text-[20px]" : "text-[16px]"
          }`}
        >
          {row.title}
        </h2>
        <p className="mt-1 text-[14px] text-zinc-700">{row.whenLabel}</p>
        {place && <p className="mt-0.5 truncate text-[13px] text-zinc-500">{place}</p>}
        {row.blurb && (
          <p
            className={`mt-2 text-[14px] leading-snug text-zinc-600 ${featured ? "line-clamp-4" : "line-clamp-2"}`}
          >
            {row.blurb}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <div>
            <p className="text-[17px] font-semibold text-leaf-800">{row.priceLabel ?? row.rateLabel}</p>
            {row.interestedCount > 0 && (
              <p className="text-[12px] text-zinc-500">{row.interestedCount} interested</p>
            )}
          </div>
          {row.applied ? (
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-medium text-leaf-800">Applied</span>
              {application && (
                <button
                  className={btnSmallQuiet}
                  disabled={busy}
                  onClick={() => onWithdraw(application.applicationId)}
                >
                  Withdraw
                </button>
              )}
            </div>
          ) : (
            <button className={btnSmallPrimary} disabled={disabled} onClick={onApply}>
              Apply to host
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function store(token: string) {
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Blocked storage: the emailed link still works.
  }
}

function forget() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to forget
  }
}

/** No usable link: ask for the email they applied with and send a fresh one. */
function GetLink({ lost }: { lost: boolean }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await Parse.Cloud.run("requestHostBoardLink", { email });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <div className={card}>
        <h1 className="text-xl font-semibold text-leaf-900">Plans that need a host</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-zinc-700">
          {lost
            ? "That link did not work. Enter the email you applied with and we will send you a new one."
            : "Enter the email you applied with and we will send you your link."}
        </p>
        {sent ? (
          <p className="mt-4 text-[15px] leading-relaxed text-leaf-900">
            If that email is on our host list, a link is on its way.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <input
              className={inputClass}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && <p className="text-[14px] text-red-700">{error}</p>}
            <button className={btnPrimary} disabled={busy || !email.trim()} onClick={send}>
              Email me my link
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}

export default function HostBoardClient({
  linkToken,
  focusKey = null,
}: {
  linkToken: string | null;
  /** A plan to open on (`kind:objectId`), from that plan's link in the digest. */
  focusKey?: string | null;
}) {
  // Cleared by "See all plans", so the board can go back to the plain grid.
  const [focus, setFocus] = useState<string | null>(focusKey);
  const [token, setToken] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(false);
  const [lost, setLost] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The link in the address wins and is remembered; otherwise use what this
  // device saved last time.
  useEffect(() => {
    const t = linkToken || readStored();
    if (linkToken) store(linkToken);
    setToken(t);
    setResolved(true);
  }, [linkToken]);

  const load = useCallback(
    async (t: string) => {
      setLoading(true);
      try {
        // Only plans in the host's own city: the board has no "everywhere".
        const r = (await Parse.Cloud.run("getHostBoard", { token: t, scope: "near" })) as Board;
        setBoard(r);
        setLost(false);
      } catch {
        forget();
        setToken(null);
        setLost(true);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (token) void load(token);
  }, [token, load]);

  const apply = async (row: BoardRow) => {
    if (!token) return;
    setBusyKey(row.key);
    setError(null);
    try {
      await Parse.Cloud.run("applyToHostPlan", { token, kind: row.kind, subjectId: row.subjectId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not apply.");
    } finally {
      setBusyKey(null);
      await load(token);
    }
  };

  const withdraw = async (applicationId: string) => {
    if (!token) return;
    setBusyKey(applicationId);
    setError(null);
    try {
      await Parse.Cloud.run("withdrawHostApplication", { token, applicationId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not withdraw.");
    } finally {
      setBusyKey(null);
      await load(token);
    }
  };

  if (!resolved) return <Shell>{null}</Shell>;
  if (!token) return <GetLink lost={lost} />;
  if (!board) {
    return (
      <Shell>
        <p className="text-[15px] text-zinc-600">{loading ? "Loading the board…" : ""}</p>
      </Shell>
    );
  }

  if (board.state === "unavailable") {
    return (
      <Shell>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
          <h1 className="text-xl font-semibold text-leaf-900">Not available right now</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-zinc-700">
            The board is not open for this link at the moment. Reply to any email from us and we
            will sort it out.
          </p>
        </div>
      </Shell>
    );
  }

  const allRows = board.rows ?? [];
  const count = board.nearCount ?? allRows.length;
  const applications = board.applications ?? [];
  const busyHosting = Boolean(board.openJob);
  const focused = focus ? allRows.find((r) => r.key === focus) ?? null : null;
  // The picked plan sits on its own at the top, so it is not repeated below.
  const rows = focused ? allRows.filter((r) => r.key !== focused.key) : allRows;
  const cardFor = (row: BoardRow, featured = false) => {
    const myApplication = applications.find((a) => a.key === row.key);
    return (
      <PlanCard
        key={row.key}
        row={row}
        application={myApplication}
        busy={busyKey === row.key || (!!myApplication && busyKey === myApplication.applicationId)}
        disabled={busyHosting || busyKey === row.key}
        onApply={() => apply(row)}
        onWithdraw={withdraw}
        featured={featured}
      />
    );
  };

  return (
    <Shell wide>
      <div>
        <h1 className="text-2xl font-semibold text-leaf-900">
          {board.host?.firstName ? `Hi ${board.host.firstName}, ` : ""}
          {count} {count === 1 ? "plan near you needs" : "plans near you need"} a host
        </h1>
        {/* How it works, in the order it happens. Kept short and scannable:
            the full pay terms are what hosts ask about, so they get a line of
            their own rather than the end of a paragraph. */}
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {HOW_IT_WORKS.map((step, i) => (
            <li key={step.title} className="flex gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-leaf-800 text-[13px] font-semibold text-white">
                {i + 1}
              </span>
              <div>
                <p className="text-[15px] font-semibold text-leaf-900">{step.title}</p>
                <p className="mt-0.5 text-[14px] leading-snug text-zinc-600">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {busyHosting && board.openJob && (
        <div className="mt-5 rounded-2xl border border-leaf-200 bg-leaf-50 p-4 text-[15px] leading-relaxed text-leaf-900">
          You are hosting <strong>{board.openJob.title}</strong>, {board.openJob.whenLabel}. You can
          apply for another plan once that one is over.
        </div>
      )}

      {error && <p className="mt-4 text-[14px] text-red-700">{error}</p>}

      {focused && (
        <section className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-leaf-900">The plan you picked</h2>
            <button className="text-[14px] font-medium text-leaf-800 underline" onClick={() => setFocus(null)}>
              See all plans
            </button>
          </div>
          <div className="mt-3 min-w-0">{cardFor(focused, true)}</div>
        </section>
      )}

      {focus && !focused && (
        <div className="mt-6 flex items-start justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-[15px] leading-relaxed text-zinc-700">
          <span>That plan is not open any more, so here is everything else near you.</span>
          <button className="shrink-0 text-[14px] font-medium text-leaf-800 underline" onClick={() => setFocus(null)}>
            OK
          </button>
        </div>
      )}

      {focused && rows.length > 0 && (
        <h2 className="mt-8 text-[15px] font-semibold text-leaf-900">More plans near you</h2>
      )}

      {rows.length === 0 && focused ? null : rows.length === 0 ? (
        <div className={`${card} mt-6`}>
          <p className="text-[15px] leading-relaxed text-zinc-700">
            Nothing open near you right now. We email new plans every couple of weeks.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => cardFor(row))}
        </div>
      )}

      <PitchSection
        token={token}
        options={board.pitchOptions ?? []}
        pitches={board.pitches ?? []}
        busyHosting={busyHosting}
        onChanged={() => load(token)}
      />

      {applications.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-leaf-900">Your applications</h2>
          <p className="mt-1 text-[14px] text-zinc-600">
            If you are picked we email you the details and you say yes or no.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {applications.map((a) => (
              <div key={a.applicationId} className={`${card} flex items-center justify-between gap-3`}>
                <div>
                  <p className="text-[15px] font-medium text-leaf-900">
                    {a.title ?? "No longer open"}
                  </p>
                  {a.whenLabel && <p className="text-[14px] text-zinc-600">{a.whenLabel}</p>}
                </div>
                <button
                  className={btnQuiet}
                  disabled={busyKey === a.applicationId}
                  onClick={() => withdraw(a.applicationId)}
                >
                  Withdraw
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </Shell>
  );
}
