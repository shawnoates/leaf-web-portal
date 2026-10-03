"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import PayHandlesForm, { describeHandles, type PayHandles } from "@/components/p2p/PayHandlesForm";
import ReceiptForwarding from "@/components/p2p/ReceiptForwarding";

type Status = "pending_lock" | "unpaid" | "claimed" | "confirmed" | "expired";
type Method = "venmo" | "cashapp" | "paypal" | "zelle";

type Guest = {
  eventNotificationId: string;
  name: string;
  photoUrl: string | null;
  status: Status;
  amountCents: number | null;
  ref: string | null;
  method: Method | null;
  holdUntil: string | null;
  claimedAt: string | null;
  autoConfirmAt: string | null;
  confirmedBy: "host" | "auto" | null;
  notReceived: boolean;
  /** Dropout swap: this guest pays back the guest who left, not you. */
  paysTo?: string | null;
  /** A forwarded receipt that looks like this seat's payment. */
  receipt?: string | null;
  /** People they're bringing; each is a seat. */
  plusOnes?: string[];
};

/** The plan's collecting settings, as setPlanP2pPayment stored them. */
type P2pConfig = {
  mode?: "fixed" | "split";
  amountCents?: number | null;
  ticketCount?: number;
  hostHasTicket?: boolean;
  totalCents?: number;
  minHeadcount?: number;
  maxHeadcount?: number;
  hostInSplit?: boolean;
  holdHours?: number | null;
};

const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;

/** "Split a total": the share comes from the headcount, fixed when it locks. */
type Split = {
  totalCents: number;
  minHeadcount: number;
  maxHeadcount: number;
  hostInSplit: boolean;
  lowCents: number;
  highCents: number;
  locked: boolean;
  lockedHeadcount: number | null;
  shareCents: number;
  headcount: number;
  belowMin: boolean;
  autoLockAt: string | null;
};

type LockPreview = { needsConfirm: true; headcount: number; guests: number; shareCents: number; belowMin: boolean };

/** Where the host forwards receipts to have them matched automatically. */
type Inbound = { address: string; forwardCode: string | null; lastReceiptAt: string | null };

type Roster = {
  inbound?: Inbound | null;
  p2pPayment: P2pConfig | null;
  /** Signed-in manager and not a locked split: may change or stop collecting. */
  canEdit?: boolean;
  /** Someone has said they paid or been confirmed: price and mode are fixed. */
  hasPayments?: boolean;
  split?: Split | null;
  canLock?: boolean;
  title?: string;
  startsAt?: string | null;
  capacity?: number | null;
  going?: number;
  canSetUp?: boolean;
  spentCents?: number;
  toCollectCents?: number;
  confirmedCents?: number;
  claimedCents?: number;
  canNudge?: boolean;
  guests: Guest[];
};

const LABELS: Record<Method, string> = { venmo: "Venmo", cashapp: "Cash App", paypal: "PayPal", zelle: "Zelle" };
const HOLD_CHOICES = [
  { v: "", label: "Auto (recommended)" },
  { v: "2", label: "2 hours" },
  { v: "12", label: "12 hours" },
  { v: "24", label: "24 hours" },
  { v: "48", label: "48 hours" },
];

function money(cents: number): string {
  const d = cents / 100;
  return `$${Number.isInteger(d) ? d : d.toFixed(2)}`;
}

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function statusLine(g: Guest): string {
  if (g.receipt && g.status !== "confirmed") return `${g.receipt} — confirm it's theirs`;
  const base = statusLineFor(g);
  return g.paysTo ? `${base} · pays ${g.paysTo} back (their old seat)` : base;
}

function statusLineFor(g: Guest): string {
  if (g.status === "pending_lock") return "In · pays once you lock the split";
  if (g.status === "confirmed") return g.confirmedBy === "auto" ? "Paid · confirmed automatically" : "Paid";
  if (g.status === "claimed") {
    return `Says they paid${g.method ? ` on ${LABELS[g.method]}` : ""}${g.autoConfirmAt ? ` · confirms itself ${when(g.autoConfirmAt)}` : ""}`;
  }
  if (g.notReceived) return `You marked it not received · held until ${g.holdUntil ? when(g.holdUntil) : "soon"}`;
  return g.holdUntil ? `Hasn't paid · held until ${when(g.holdUntil)}` : "Hasn't paid";
}

export default function PayHostClient({
  planId, token, confirmId, viewer,
}: {
  planId: string;
  token: string | null;
  confirmId: string | null;
  /** Signed viewer pair from the app's link: sign in as them first. */
  viewer: { userId: string; token: string } | null;
}) {
  const [roster, setRoster] = useState<Roster | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const params = useCallback((extra: Record<string, unknown> = {}) => ({
    ...(token ? { token } : {}),
    ...extra,
  }), [token]);

  const load = useCallback(async () => {
    try {
      const r = (await Parse.Cloud.run("getP2pRoster", params({ eventGroupId: planId }))) as Roster;
      setRoster(r);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "We couldn't load this page.");
    }
  }, [params, planId]);

  useEffect(() => {
    (async () => {
      // Same trade /me makes for its digest links. A failure just leaves the
      // page on the plan token: roster yes, setup no.
      if (viewer && Parse.User.current()?.id !== viewer.userId) {
        try {
          const r = (await Parse.Cloud.run("getDashboardSession", viewer)) as { sessionToken?: string } | null;
          if (r?.sessionToken?.startsWith("r:")) await Parse.User.become(r.sessionToken);
        } catch { /* fall through to the token */ }
      }
      if (viewer) {
        // Don't leave a sign-in link sitting in the address bar or history.
        const url = new URL(window.location.href);
        url.searchParams.delete("u");
        url.searchParams.delete("vt");
        window.history.replaceState(null, "", url.toString());
      }
      await load();
    })();
  }, [load, viewer]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const act = async (fn: "confirmP2pPayment" | "markP2pNotReceived", g: Guest) => {
    setBusyId(g.eventNotificationId);
    setError(null);
    try {
      const r = (await Parse.Cloud.run(fn, params({ notificationId: g.eventNotificationId }))) as { seat?: Partial<Guest> };
      setRoster((prev) => prev && ({
        ...prev,
        guests: prev.guests.map((x) => (x.eventNotificationId === g.eventNotificationId ? { ...x, ...r.seat } as Guest : x)),
      }));
      setToast(fn === "confirmP2pPayment" ? `${g.name.split(" ")[0]} is confirmed.` : `We told ${g.name.split(" ")[0]} to check their payment.`);
      // Totals and the nudge state come from the server; refresh quietly.
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  const nudge = async () => {
    setBusyId("nudge");
    setError(null);
    try {
      const r = (await Parse.Cloud.run("nudgeP2pUnpaid", params({ eventGroupId: planId }))) as { nudged: number };
      setToast(r.nudged ? `Reminded ${r.nudged} ${r.nudged === 1 ? "person" : "people"}.` : "Nobody could be reached right now.");
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send reminders.");
    } finally {
      setBusyId(null);
    }
  };

  // Split: lock the headcount. Below the minimum the server answers with
  // the higher share first, and this asks before locking with force.
  const [lockAsk, setLockAsk] = useState<LockPreview | null>(null);
  // Changing the settings after setup: the setup form, filled in.
  const [editing, setEditing] = useState(false);
  const lock = async (force = false) => {
    setBusyId("lock");
    setError(null);
    try {
      const r = (await Parse.Cloud.run("lockP2pSplit", params({ eventGroupId: planId, force }))) as
        LockPreview | { locked: true; shareCents: number; headcount: number; guests: number };
      if ("needsConfirm" in r) {
        setLockAsk(r);
      } else {
        setLockAsk(null);
        setToast(`Locked: ${money(r.shareCents)} each, ${r.headcount} people. We told ${r.guests} ${r.guests === 1 ? "guest" : "guests"} what to pay.`);
        void load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't lock the split.");
    } finally {
      setBusyId(null);
    }
  };

  const focus = useMemo(
    () => (confirmId && roster ? roster.guests.find((g) => g.eventNotificationId === confirmId) || null : null),
    [confirmId, roster],
  );

  let body: React.ReactNode;
  if (loadError) {
    body = (
      <div className="ph-empty">
        <p>{loadError}</p>
        {!token && <p className="ph-muted">Open the link from your text, or <Link href="/me">sign in to Leaf</Link>.</p>}
      </div>
    );
  } else if (!roster) {
    body = <div className="ph-empty" aria-busy="true"><p className="ph-muted">Loading…</p></div>;
  } else if (!roster.p2pPayment) {
    body = roster.canSetUp
      ? <Setup planId={planId} roster={roster} onDone={load} />
      : (
        <div className="ph-empty">
          <p>This plan isn&apos;t collecting money.</p>
          <p className="ph-muted">Sign in to Leaf as the host to set it up.</p>
        </div>
      );
  } else {
    const guests = roster.guests;
    const unpaid = guests.filter((g) => g.status === "unpaid").length;
    const claimed = guests.filter((g) => g.status === "claimed").length;
    const confirmed = guests.filter((g) => g.status === "confirmed").length;
    const open = Math.max(0, (roster.capacity || 0) - guests.length);
    const collected = roster.confirmedCents || 0;
    const target = roster.toCollectCents || 0;
    const pct = target ? Math.min(100, Math.round((collected / target) * 100)) : 0;
    const order: Record<Status, number> = { claimed: 0, unpaid: 1, pending_lock: 2, confirmed: 3, expired: 4 };
    const split = roster.split || null;
    const waiting = guests.filter((g) => g.status === "pending_lock").length;
    const sorted = [...guests].sort((a, b) => order[a.status] - order[b.status]);
    const openSplit = split && !split.locked ? split : null;

    body = editing ? (
      <Setup
        planId={planId}
        roster={roster}
        existing={roster.p2pPayment}
        hasPayments={Boolean(roster.hasPayments)}
        onCancel={() => setEditing(false)}
        onDone={(msg) => { setEditing(false); if (msg) setToast(msg); void load(); }}
      />
    ) : (
      <>
        {focus && focus.status === "claimed" && (
          <div className="ph-focus">
            <p className="ph-focus-h">
              {focus.name.split(" ")[0]} says they paid {money(focus.amountCents || 0)}
              {focus.method ? ` on ${LABELS[focus.method]}` : ""}
            </p>
            <p className="ph-muted">Look for <b className="ph-code">{focus.ref}</b> in the note.</p>
            <div className="ph-row-actions">
              <button className="ph-btn primary" disabled={busyId === focus.eventNotificationId} onClick={() => act("confirmP2pPayment", focus)}>Confirm</button>
              <button className="ph-btn ghost" disabled={busyId === focus.eventNotificationId} onClick={() => act("markP2pNotReceived", focus)}>Not received</button>
            </div>
          </div>
        )}

        <div className="ph-sum">
          {roster.canEdit && <button className="ph-link ph-edit" onClick={() => setEditing(true)}>Edit</button>}
          {openSplit ? (
            // Nothing is owed until the split locks: show what's being split.
            <div className="ph-sum-top">
              <span className="ph-big">{money(openSplit.totalCents)}</span>
              <span className="ph-muted"> to split</span>
            </div>
          ) : (
            <>
              <div className="ph-sum-top">
                <span className="ph-big">{money(collected)}</span>
                <span className="ph-muted"> of {money(target)} collected</span>
              </div>
              <div className="ph-bar"><span style={{ width: `${pct}%` }} /></div>
            </>
          )}
          <p className="ph-muted ph-small">
            {openSplit
              ? openSplit.belowMin
                ? `${money(openSplit.lowCents)}–${money(openSplit.highCents)} each once ${openSplit.minHeadcount}+ are in`
                : `${money(openSplit.shareCents)} each with ${people(openSplit.headcount)} right now`
              : split
                ? `${money(split.shareCents)} each, ${people(split.headcount)} · you spent ${money(roster.spentCents || 0)}`
                : `${money(roster.p2pPayment.amountCents || 0)} a spot · you spent ${money(roster.spentCents || 0)}`}
            {(roster.claimedCents || 0) > 0 ? ` · ${money(roster.claimedCents || 0)} waiting on you` : ""}
          </p>
          <div className="ph-chips">
            {split && !split.locked ? (
              <>
                <span>{split.headcount} in{split.hostInSplit ? " (with you)" : ""}</span>
                <span className={split.belowMin ? "warn" : ""}>needs {split.minHeadcount}</span>
                <span>room for {split.maxHeadcount}</span>
              </>
            ) : (
              <>
                <span>{confirmed} paid</span>
                <span className={claimed ? "warn" : ""}>{claimed} to confirm</span>
                <span>{unpaid} unpaid</span>
                <span>{open} open</span>
              </>
            )}
          </div>
        </div>

        {split && !split.locked && (
          <div className="ph-lock">
            <p className="ph-lock-h">
              {split.belowMin
                ? `Splitting ${money(split.totalCents)} between ${split.minHeadcount}–${split.maxHeadcount} people`
                : `Splitting ${money(split.totalCents)} · ${money(split.shareCents)} each with ${people(split.headcount)}`}
            </p>
            <p className="ph-muted ph-small">
              Guests pay once you lock the headcount: {money(split.lowCents)} each if {split.maxHeadcount} come,
              {" "}{money(split.highCents)} at {split.minHeadcount}.
              {split.autoLockAt ? ` It locks on its own ${when(split.autoLockAt)}${split.belowMin ? " — unless fewer than " + split.minHeadcount + " are in, then we'll ask you" : ""}.` : ""}
              {" "}Locking closes RSVPs at that headcount.
            </p>
            {lockAsk ? (
              <div className="ph-lock-ask">
                <p>
                  Only {lockAsk.headcount} of the {split.minHeadcount} people you needed. Locking now makes it
                  {" "}<b>{money(lockAsk.shareCents)} each</b> — more than the {money(split.highCents)} guests saw.
                  We&apos;ll tell them before they pay.
                </p>
                <div className="ph-row-actions">
                  <button className="ph-btn primary sm" disabled={busyId === "lock"} onClick={() => lock(true)}>Lock at {money(lockAsk.shareCents)} each</button>
                  <button className="ph-btn ghost sm" disabled={busyId === "lock"} onClick={() => setLockAsk(null)}>Not yet</button>
                </div>
                <p className="ph-muted ph-small">To call it off, cancel the plan from the plan page.</p>
              </div>
            ) : (
              <button className="ph-btn primary wide" disabled={!roster.canLock || busyId === "lock"} onClick={() => lock(false)}>
                {roster.canLock ? `Lock at ${people(split.headcount)} · ${money(split.shareCents)} each` : "Lock once someone joins"}
              </button>
            )}
            {waiting > 0 && <p className="ph-muted ph-small">{waiting} {waiting === 1 ? "guest is" : "guests are"} waiting to hear their share.</p>}
          </div>
        )}

        {unpaid > 0 && (
          <button className="ph-btn ghost wide" disabled={!roster.canNudge || busyId === "nudge"} onClick={nudge}>
            {roster.canNudge ? `Remind ${unpaid} unpaid` : "Reminded recently"}
          </button>
        )}

        {roster.inbound && <ReceiptForwarding inbound={roster.inbound} />}

        {sorted.length === 0 ? (
          <p className="ph-muted ph-none">Nobody has taken a spot yet.</p>
        ) : (
          <ul className="ph-list">
            {sorted.map((g) => (
              <li key={g.eventNotificationId} className={g.eventNotificationId === confirmId ? "hl" : ""}>
                <div className="ph-ava">
                  {g.photoUrl ? <img src={g.photoUrl} alt="" /> : <span>{g.name.slice(0, 1).toUpperCase()}</span>}
                </div>
                <div className="ph-who">
                  <p className="ph-name">
                    {g.name}{(g.plusOnes?.length ?? 0) > 0 && <span className="ph-plus"> +{g.plusOnes!.length}</span>}
                  </p>
                  {(g.plusOnes?.length ?? 0) > 0 && <p className="ph-st">with {g.plusOnes!.join(", ")}</p>}
                  <p className={`ph-st ${g.status}`}>{statusLine(g)}</p>
                </div>
                <div className="ph-row-actions">
                  {/* A swapped seat pays the guest who left; they confirm it. */}
                  {!g.paysTo && g.status === "claimed" && (
                    <>
                      <button className="ph-btn primary sm" disabled={busyId === g.eventNotificationId} onClick={() => act("confirmP2pPayment", g)}>Confirm</button>
                      <button className="ph-btn ghost sm" disabled={busyId === g.eventNotificationId} onClick={() => act("markP2pNotReceived", g)}>Not received</button>
                    </>
                  )}
                  {!g.paysTo && g.status === "unpaid" && g.receipt && (
                    <button className="ph-btn primary sm" disabled={busyId === g.eventNotificationId} onClick={() => act("confirmP2pPayment", g)}>Confirm</button>
                  )}
                  {!g.paysTo && g.status === "unpaid" && !g.receipt && (
                    <button className="ph-btn ghost sm" title="Paid you some other way, like cash" disabled={busyId === g.eventNotificationId} onClick={() => act("confirmP2pPayment", g)}>Mark paid</button>
                  )}
                  {!g.paysTo && g.status === "confirmed" && (
                    <button className="ph-link" disabled={busyId === g.eventNotificationId} onClick={() => act("markP2pNotReceived", g)}>Not received?</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  return (
    <main className="ph">
      <style>{CSS}</style>
      <div className="ph-in">
        <p className="ph-eyebrow">Payments</p>
        <h1 className="ph-title">{roster?.title || "Your plan"}</h1>
        {roster?.startsAt && <p className="ph-muted">{when(roster.startsAt)}</p>}
        {error && <p className="ph-err">{error}</p>}
        {toast && <p className="ph-toast" role="status">{toast}</p>}
        <div className="ph-body">{body}</div>
        <p className="ph-foot">Guests pay you directly. Leaf never touches the money — it just keeps track.</p>
      </div>
    </main>
  );
}

// ---- Setup: turn on collecting for a plan ----------------------------------

const dollarsField = (cents?: number | null) => (cents ? String(cents / 100) : "");

function Setup({
  planId, roster, onDone, existing = null, hasPayments = false, onCancel,
}: {
  planId: string;
  roster: Roster;
  onDone: (message?: string) => void;
  /** Editing: the current settings to start from. */
  existing?: P2pConfig | null;
  /** Someone has paid: the mode and the price can't change any more. */
  hasPayments?: boolean;
  onCancel?: () => void;
}) {
  const [handles, setHandles] = useState<PayHandles | null | undefined>(undefined);
  const [editingHandles, setEditingHandles] = useState(false);
  const [mode, setMode] = useState<"fixed" | "split">(existing?.mode === "split" ? "split" : "fixed");
  const [price, setPrice] = useState(dollarsField(existing?.mode !== "split" ? existing?.amountCents : null));
  const [spots, setSpots] = useState(existing?.ticketCount ? String(existing.ticketCount) : roster.capacity ? String(roster.capacity + 1) : "");
  const [mine, setMine] = useState(existing ? (existing.mode === "split" ? existing.hostInSplit !== false : existing.hostHasTicket !== false) : true);
  // Split a total
  const [total, setTotal] = useState(dollarsField(existing?.totalCents));
  const [minPeople, setMinPeople] = useState(existing?.minHeadcount ? String(existing.minHeadcount) : "");
  const [maxPeople, setMaxPeople] = useState(existing?.maxHeadcount ? String(existing.maxHeadcount) : roster.capacity ? String(roster.capacity + 1) : "");
  const [hold, setHold] = useState(existing?.holdHours ? String(existing.holdHours) : "");
  const priceLocked = Boolean(existing && hasPayments);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Parse.Cloud.run("getMyPayHandles", {})
      .then((r: { handles: PayHandles | null }) => setHandles(r.handles))
      .catch(() => setHandles(null));
  }, []);

  const cents = Math.round(parseFloat(price || "0") * 100);
  const count = parseInt(spots || "0", 10);
  const guestSpots = count - (mine ? 1 : 0);
  const totalCents = Math.round(parseFloat(total || "0") * 100);
  const minN = parseInt(minPeople || "0", 10);
  const maxN = parseInt(maxPeople || "0", 10);
  const splitOk = totalCents >= 100 && minN >= 2 && maxN >= minN && maxN - (mine ? 1 : 0) >= 1;
  const ready = mode === "split" ? splitOk : cents >= 100 && guestSpots >= 1;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await Parse.Cloud.run("setPlanP2pPayment", mode === "split"
        ? {
          eventGroupId: planId, mode: "split", totalCents, minHeadcount: minN, maxHeadcount: maxN,
          hostInSplit: mine, holdHours: hold ? Number(hold) : null,
        }
        : {
          eventGroupId: planId, amountCents: cents, ticketCount: count, hostHasTicket: mine,
          holdHours: hold ? Number(hold) : null,
        });
      onDone(existing ? "Saved." : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : existing ? "Couldn't save." : "Couldn't turn this on.");
    } finally {
      setBusy(false);
    }
  };

  // Stop collecting: only while nobody has paid (the server refuses after).
  const stop = async () => {
    if (!window.confirm("Stop collecting money for this plan? Guests holding a spot won't owe anything.")) return;
    setBusy(true);
    setError(null);
    try {
      await Parse.Cloud.run("setPlanP2pPayment", { eventGroupId: planId, off: true });
      onDone("Stopped collecting.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't stop collecting.");
    } finally {
      setBusy(false);
    }
  };

  if (handles === undefined) return <p className="ph-muted">Loading…</p>;
  if (!handles || editingHandles) {
    return (
      <div className="ph-setup">
        <p className="ph-setup-h">Collect money for this plan</p>
        <PayHandlesForm
          initial={handles}
          saveLabel="Continue"
          onCancel={handles ? () => setEditingHandles(false) : undefined}
          onSaved={(h) => { setHandles(h); setEditingHandles(false); }}
        />
      </div>
    );
  }

  return (
    <div className="ph-setup">
      <p className="ph-setup-h">{existing ? "Change how you collect" : "Collect money for this plan"}</p>
      <p className="ph-muted">
        {priceLocked
          ? "Someone has already paid, so the price and how it's split stay as they are. You can still change spots and the hold."
          : "You bought the tickets or booked the spot; everyone who joins pays you back."}
      </p>
      <fieldset className="ph-fs" disabled={priceLocked}>
      <div className="ph-seg" role="radiogroup" aria-label="How guests pay">
        <button role="radio" aria-checked={mode === "fixed"} className={mode === "fixed" ? "on" : ""} onClick={() => setMode("fixed")}>
          Price per spot<small>Tickets, a set price</small>
        </button>
        <button role="radio" aria-checked={mode === "split"} className={mode === "split" ? "on" : ""} onClick={() => setMode("split")}>
          Split a total<small>A court, a table — depends on headcount</small>
        </button>
      </div>
      </fieldset>
      {mode === "split" ? (
        <>
          <label className="ph-field">
            <span>Total you paid</span>
            <div className="ph-money"><b>$</b><input inputMode="decimal" value={total} placeholder="120" disabled={priceLocked} onChange={(e) => setTotal(e.target.value.replace(/[^\d.]/g, "").slice(0, 8))} /></div>
          </label>
          <div className="ph-grid">
            <label className="ph-field">
              <span>Fewest people</span>
              <input inputMode="numeric" value={minPeople} placeholder="4" onChange={(e) => setMinPeople(e.target.value.replace(/\D/g, "").slice(0, 3))} />
            </label>
            <label className="ph-field">
              <span>Most people</span>
              <input inputMode="numeric" value={maxPeople} placeholder="8" onChange={(e) => setMaxPeople(e.target.value.replace(/\D/g, "").slice(0, 3))} />
            </label>
          </div>
          <label className="ph-check">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
            <span>Count me in the split</span>
          </label>
          {splitOk && (
            <p className="ph-calc">
              {money(Math.ceil(totalCents / maxN))}–{money(Math.ceil(totalCents / minN))} each, depending on how many come.
              It locks a day before the plan, or when you lock it.
            </p>
          )}
        </>
      ) : (
      <>
      <div className="ph-grid">
        <label className="ph-field">
          <span>Price per spot</span>
          <div className="ph-money"><b>$</b><input inputMode="decimal" value={price} placeholder="60" disabled={priceLocked} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, "").slice(0, 7))} /></div>
        </label>
        <label className="ph-field">
          <span>Tickets / spots you have</span>
          <input inputMode="numeric" value={spots} placeholder="8" onChange={(e) => setSpots(e.target.value.replace(/\D/g, "").slice(0, 3))} />
        </label>
      </div>
      <label className="ph-check">
        <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
        <span>One of these is mine</span>
      </label>
      {count > 0 && cents > 0 && guestSpots > 0 && (
        <p className="ph-calc">
          {guestSpots} {guestSpots === 1 ? "spot" : "spots"} for guests · you&apos;ll collect {money(cents * guestSpots)} of the {money(cents * count)} you spent
        </p>
      )}
      </>
      )}
      {(roster.going || 0) > 0 && (
        <p className="ph-muted ph-small">
          {roster.going} already going will be asked to pay too{mode === "split" ? " once it locks" : ""}.
        </p>
      )}
      <label className="ph-field">
        <span>Hold a spot while they pay</span>
        <select value={hold} onChange={(e) => setHold(e.target.value)}>
          {HOLD_CHOICES.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
        </select>
      </label>
      <div className="ph-paidto">
        <span>Paid to {describeHandles(handles)}</span>
        <button className="ph-link" onClick={() => setEditingHandles(true)}>Edit</button>
      </div>
      {error && <p className="ph-err">{error}</p>}
      <button className="ph-btn primary wide" disabled={busy || !ready} onClick={submit}>
        {busy ? (existing ? "Saving…" : "Turning on…") : existing ? "Save changes" : "Start collecting"}
      </button>
      {existing && (
        <div className="ph-setup-foot">
          {onCancel && <button className="ph-btn ghost" disabled={busy} onClick={onCancel}>Cancel</button>}
          {!hasPayments && <button className="ph-link ph-stop" disabled={busy} onClick={stop}>Stop collecting</button>}
        </div>
      )}
    </div>
  );
}

const CSS = `
.ph{min-height:100vh;background:#faf9f7;color:#17150f;font-family:var(--font-geist-sans,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);-webkit-font-smoothing:antialiased}
.ph-in{max-width:560px;margin:0 auto;padding:32px 16px 48px}
.ph p{margin:0}
.ph-eyebrow{font-family:var(--font-geist-mono,ui-monospace,monospace);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#8b8578}
.ph-title{font-size:26px;line-height:1.2;font-weight:500;margin:6px 0 2px;overflow-wrap:anywhere}
.ph-muted{color:#6f6a5f;font-size:13px}
.ph-small{font-size:12px;margin-top:6px}
.ph-body{display:grid;gap:14px;margin-top:20px}
.ph-empty{background:#fff;border:1px solid rgba(0,0,0,.09);border-radius:14px;padding:22px;display:grid;gap:6px}
.ph-empty a{text-decoration:underline}
.ph-focus{background:#fff;border:1.5px solid #17150f;border-radius:14px;padding:16px;display:grid;gap:6px}
.ph-focus-h{font-size:17px;font-weight:600}
.ph-code{font-family:var(--font-geist-mono,ui-monospace,monospace);letter-spacing:.04em}
.ph-sum{background:#fff;border:1px solid rgba(0,0,0,.09);border-radius:14px;padding:16px}
.ph-big{font-size:28px;font-weight:600}
.ph-bar{height:6px;border-radius:999px;background:#e9e6df;margin-top:10px;overflow:hidden}
.ph-bar span{display:block;height:100%;background:#253a33;border-radius:999px;transition:width .3s ease}
.ph-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.ph-chips span{font-size:11.5px;padding:4px 9px;border-radius:999px;background:#f2f0eb;color:#6f6a5f}
.ph-chips span.warn{background:#fff7ed;color:#9a3412}
.ph-list{list-style:none;margin:0;padding:0;background:#fff;border:1px solid rgba(0,0,0,.09);border-radius:14px;overflow:hidden}
.ph-list li{display:flex;align-items:center;gap:12px;padding:12px 14px;border-top:1px solid rgba(0,0,0,.06);flex-wrap:wrap}
.ph-list li:first-child{border-top:0}
.ph-list li.hl{background:#f3f7f5}
.ph-ava{width:34px;height:34px;border-radius:999px;background:#e3e0d8;overflow:hidden;display:grid;place-items:center;flex:none;font-size:13px;color:#6f6a5f}
.ph-ava img{width:100%;height:100%;object-fit:cover}
.ph-who{flex:1 1 160px;min-width:0}
.ph-name{font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ph-st{font-size:12px;color:#8b8578}
.ph-st.confirmed{color:#253a33}
.ph-st.claimed{color:#9a3412}
.ph-row-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.ph-btn{border-radius:8px;padding:9px 16px;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;border:1px solid #17150f}
.ph-btn.primary{background:#17150f;color:#fff}
.ph-btn.ghost{background:#fff;color:#17150f;border-color:rgba(0,0,0,.18)}
.ph-btn.sm{padding:7px 12px;font-size:12px}
.ph-btn.wide{width:100%}
.ph-btn:disabled{opacity:.5;cursor:default}
.ph-link{border:0;background:none;color:#8b8578;font:inherit;font-size:12px;text-decoration:underline;cursor:pointer;padding:0}
.ph-none{text-align:center;padding:12px 0}
.ph-err{color:#b91c1c;font-size:12.5px;margin-top:10px !important}
.ph-toast{color:#253a33;font-size:12.5px;margin-top:10px !important}
.ph-foot{margin-top:28px !important;font-size:11.5px;color:#8b8578;text-align:center}
.ph-setup{background:#fff;border:1px solid rgba(0,0,0,.09);border-radius:14px;padding:18px;display:grid;gap:12px}
.ph-setup-h{font-size:17px;font-weight:600}
.ph-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ph-field{display:grid;gap:4px}
.ph-field>span{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#8b8578}
.ph-field input,.ph-field select,.ph-money{border:1px solid rgba(0,0,0,.15);border-radius:8px;padding:9px 11px;font:inherit;font-size:14px;color:#17150f;background:#fff;min-width:0;width:100%}
.ph-money{display:flex;align-items:center;gap:4px}
.ph-money b{font-weight:500;color:#8b8578}
.ph-money input{border:0;padding:0;outline:none;font:inherit;width:100%;min-width:0}
.ph-check{display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer}
.ph-calc{font-size:13px;background:#f3f7f5;color:#253a33;border-radius:8px;padding:8px 10px}
.ph-paidto{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;color:#6f6a5f;background:#faf9f7;border-radius:8px;padding:9px 11px}
.ph-sum{position:relative}
.ph-plus{color:#6f6a5f;font-weight:400}
.ph-edit{position:absolute;top:14px;right:16px;font-size:12.5px}
.ph-fs{border:0;margin:0;padding:0;min-width:0}
.ph-fs:disabled .ph-seg button{opacity:.55;cursor:default}
.ph-field input:disabled{background:#faf9f7;color:#8b8578}
.ph-setup-foot{display:flex;justify-content:space-between;align-items:center;gap:10px}
.ph-stop{color:#b91c1c !important}
.ph-seg{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ph-seg button{display:grid;gap:2px;text-align:left;border:1px solid rgba(0,0,0,.15);border-radius:10px;background:#fff;padding:10px 12px;font:inherit;font-size:13px;font-weight:600;color:#17150f;cursor:pointer}
.ph-seg button small{font-size:11.5px;font-weight:400;color:#8b8578}
.ph-seg button.on{border-color:#17150f;background:#faf9f7;box-shadow:inset 0 0 0 1px #17150f}
.ph-lock{background:#fff;border:1px solid rgba(0,0,0,.09);border-radius:14px;padding:16px;display:grid;gap:10px}
.ph-lock-h{font-size:15px;font-weight:600}
.ph-lock-ask{background:#fff7ed;border-radius:10px;padding:12px;display:grid;gap:8px;font-size:13px;color:#7c2d12}
@media (max-width:420px){.ph-grid{grid-template-columns:1fr}.ph-seg{grid-template-columns:1fr}}
`;
