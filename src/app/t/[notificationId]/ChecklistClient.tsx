"use client";

import { useCallback, useMemo, useState } from "react";
import { CalendarDays, Check, Clock, Lock, Plus } from "lucide-react";
import Parse from "@/lib/parse-client";

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
};

export type HostChecklist = {
  notificationId: string;
  planId: string;
  planTitle: string;
  calendarName: string | null;
  dateISO: string | null;
  cancelled: boolean;
  tasks: HostTask[];
};

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

function Row({
  task,
  busy,
  onToggle,
}: {
  task: HostTask;
  busy: boolean;
  onToggle: (t: HostTask) => void;
}) {
  const done = task.status === "done";

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
            <span className="block text-[13px] text-zinc-500 mt-0.5 leading-relaxed">
              {task.detail}
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
        </span>
      </button>
    </li>
  );
}

export default function ChecklistClient({
  notificationId,
  initial,
  initialError,
}: {
  notificationId: string;
  initial: HostChecklist | null;
  initialError: string | null;
}) {
  const [data, setData] = useState<HostChecklist | null>(initial);
  const [error, setError] = useState<string | null>(initialError);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const tasks = data?.tasks ?? [];
  const { open, done } = useMemo(
    () => ({
      open: tasks.filter((t) => t.status !== "done"),
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

        <ul className="mt-1">
          {open.map((t) => (
            <Row key={t.id} task={t} busy={busyId === t.id} onToggle={toggle} />
          ))}
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
              {done.map((t) => (
                <Row
                  key={t.id}
                  task={t}
                  busy={busyId === t.id}
                  onToggle={toggle}
                />
              ))}
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
