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
  scope?: "near" | "all";
  nearCount?: number;
  totalCount?: number;
  payTerms?: string;
  openJob?: { title: string; whenLabel: string } | null;
  rows?: BoardRow[];
  applications?: Application[];
};

const STORAGE_KEY = "leaf.hostBoardToken";

const card = "rounded-2xl border border-zinc-200 bg-white p-5";
const btnPrimary =
  "rounded-lg bg-leaf-800 px-4 py-2.5 text-[15px] font-medium text-white " +
  "transition-colors hover:bg-leaf-900 disabled:opacity-50";
const btnQuiet =
  "rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-[15px] " +
  "font-medium text-leaf-900 transition-colors hover:border-zinc-400 disabled:opacity-50";
const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-[16px] " +
  "text-leaf-900 placeholder:text-zinc-400 outline-none " +
  "focus:border-leaf-600 focus:ring-2 focus:ring-leaf-600/20";

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-lg px-5 py-10 pb-24">{children}</main>;
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

export default function HostBoardClient({ linkToken }: { linkToken: string | null }) {
  const [token, setToken] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  const [board, setBoard] = useState<Board | null>(null);
  const [scope, setScope] = useState<"near" | "all">("near");
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
    async (t: string, s: "near" | "all") => {
      setLoading(true);
      try {
        const r = (await Parse.Cloud.run("getHostBoard", { token: t, scope: s })) as Board;
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
    if (token) void load(token, scope);
  }, [token, scope, load]);

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
      await load(token, scope);
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
      await load(token, scope);
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

  const rows = board.rows ?? [];
  const applications = board.applications ?? [];
  const busyHosting = Boolean(board.openJob);

  return (
    <Shell>
      <h1 className="text-2xl font-semibold text-leaf-900">
        {board.host?.firstName ? `Hi ${board.host.firstName}, ` : ""}plans that need a host
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-zinc-700">
        What each plan pays is shown on it. {board.payTerms}
      </p>

      {busyHosting && board.openJob && (
        <div className="mt-5 rounded-2xl border border-leaf-200 bg-leaf-50 p-4 text-[15px] leading-relaxed text-leaf-900">
          You are hosting <strong>{board.openJob.title}</strong>, {board.openJob.whenLabel}. You can
          apply for another plan once that one is over.
        </div>
      )}

      <div className="mt-6 flex gap-2">
        <button
          className={scope === "near" ? btnPrimary : btnQuiet}
          onClick={() => setScope("near")}
        >
          Near me ({board.nearCount ?? 0})
        </button>
        <button
          className={scope === "all" ? btnPrimary : btnQuiet}
          onClick={() => setScope("all")}
        >
          Everywhere ({board.totalCount ?? 0})
        </button>
      </div>

      {error && <p className="mt-4 text-[14px] text-red-700">{error}</p>}

      <div className="mt-5 space-y-3">
        {rows.length === 0 && (
          <div className={card}>
            <p className="text-[15px] leading-relaxed text-zinc-700">
              {scope === "near"
                ? "Nothing open near you right now. We email new plans every couple of weeks, or look everywhere."
                : "Nothing is open right now. Check back soon."}
            </p>
          </div>
        )}
        {rows.map((row) => {
          const myApplication = applications.find((a) => a.key === row.key);
          return (
            <div key={row.key} className={card}>
              <h2 className="text-[17px] font-semibold text-leaf-900">{row.title}</h2>
              <p className="mt-1 text-[15px] text-zinc-700">{row.whenLabel}</p>
              <p className="mt-1 text-[14px] text-zinc-500">
                {[row.neighborhoods.slice(0, 2).join(", "), row.calendarName]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="mt-3 text-[15px] font-medium text-leaf-900">
                {row.rateLabel}
                {row.interestedCount > 0 && (
                  <span className="ml-2 font-normal text-zinc-500">
                    {row.interestedCount} interested
                  </span>
                )}
              </p>
              <div className="mt-4">
                {row.applied ? (
                  <div className="flex items-center gap-3">
                    <span className="text-[15px] font-medium text-leaf-800">Applied</span>
                    {myApplication && (
                      <button
                        className={btnQuiet}
                        disabled={busyKey === myApplication.applicationId}
                        onClick={() => withdraw(myApplication.applicationId)}
                      >
                        Withdraw
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    className={btnPrimary}
                    disabled={busyHosting || busyKey === row.key}
                    onClick={() => apply(row)}
                  >
                    Apply to host
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {applications.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-leaf-900">Your applications</h2>
          <p className="mt-1 text-[14px] text-zinc-600">
            If you are picked we email you the details and you say yes or no.
          </p>
          <div className="mt-3 space-y-2">
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
