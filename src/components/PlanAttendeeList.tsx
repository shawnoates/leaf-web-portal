"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Ellipsis } from "lucide-react";

export type Attendee = {
  notificationId: string;
  name: string;
  phone: string | null;
  sharePhoneWithHost: boolean;
  status: string;
  rsvpNote: string | null;
};

type Props = {
  attendees: Attendee[];
  onApprove: (a: Attendee) => Promise<void>;
  onDecline: (a: Attendee) => Promise<void>;
  onRemove: (a: Attendee) => Promise<void>;
};

const AVATAR_PALETTE = ["#253A33", "#6B4F2A", "#3C4A5C", "#5B7A6A"];

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2";

export function isPendingStatus(status: string) {
  return status === "pendingRsvp" || status === "Requested";
}

export function formatPhoneDisplay(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length === 10 && (digits.length === 10 || digits.length === 11)) {
    return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
  }
  return phone;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

function paletteFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function statusPill(status: string) {
  const s = status.toLowerCase();
  if (s === "accepted" || s === "going") {
    return { label: "Going", cls: "bg-emerald-50 text-emerald-800", dot: "bg-emerald-700" };
  }
  if (s === "maybe") return { label: "Maybe", cls: "bg-amber-50 text-amber-800", dot: "bg-amber-600" };
  if (s === "waitlist") return { label: "Waitlist", cls: "bg-zinc-100 text-zinc-600", dot: "bg-zinc-500" };
  if (isPendingStatus(status)) {
    return { label: "Pending", cls: "bg-amber-50 text-amber-800", dot: "bg-amber-600" };
  }
  return { label: status, cls: "bg-zinc-100 text-zinc-600", dot: "bg-zinc-500" };
}

export default function PlanAttendeeList({ attendees, onApprove, onDecline, onRemove }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [menuForId, setMenuForId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Attendee | null>(null);
  const [removing, setRemoving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  };

  const copyNumber = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      showToast("Copied");
    } catch {
      showToast("Couldn't copy");
    }
  };

  return (
    <>
      <ul className="mt-3 rounded-xl border border-zinc-200">
        {attendees.map((a, i) => (
          <AttendeeRow
            key={a.notificationId}
            attendee={a}
            first={i === 0}
            expanded={expandedId === a.notificationId}
            onToggle={() =>
              setExpandedId((cur) => (cur === a.notificationId ? null : a.notificationId))
            }
            menuOpen={menuForId === a.notificationId}
            onMenuOpenChange={(open) => setMenuForId(open ? a.notificationId : null)}
            onCopyNumber={copyNumber}
            onApprove={onApprove}
            onDecline={onDecline}
            onRemove={(x) => setConfirmRemove(x)}
          />
        ))}
        <li className="px-3.5 py-2.5 text-xs text-zinc-400 bg-zinc-50 border-t border-zinc-100 rounded-b-xl">
          Tap a row for the full note. Remove someone from the ⋯ menu.
        </li>
      </ul>

      {confirmRemove && (
        <ConfirmRemoveDialog
          attendee={confirmRemove}
          busy={removing}
          onCancel={() => setConfirmRemove(null)}
          onConfirm={async () => {
            setRemoving(true);
            try {
              await onRemove(confirmRemove);
              setConfirmRemove(null);
            } finally {
              setRemoving(false);
            }
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] px-3.5 py-2 rounded-lg bg-zinc-900 text-white text-sm shadow-lg"
        >
          {toast}
        </div>
      )}
    </>
  );
}

type RowProps = {
  attendee: Attendee;
  first: boolean;
  expanded: boolean;
  onToggle: () => void;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onCopyNumber: (phone: string) => void;
  onApprove: (a: Attendee) => Promise<void>;
  onDecline: (a: Attendee) => Promise<void>;
  onRemove: (a: Attendee) => void;
};

function AttendeeRow({
  attendee: a,
  first,
  expanded,
  onToggle,
  menuOpen,
  onMenuOpenChange,
  onCopyNumber,
  onApprove,
  onDecline,
  onRemove,
}: RowProps) {
  const pill = statusPill(a.status);
  const hasNote = !!a.rsvpNote;
  const firstName = a.name.trim().split(/\s+/)[0] || a.name;
  const pending = isPendingStatus(a.status);

  return (
    <li
      onClick={hasNote ? onToggle : undefined}
      className={`grid grid-cols-[36px_1fr_auto_28px] gap-3 items-center px-3.5 py-3 ${first ? "" : "border-t border-zinc-100"} ${hasNote ? "cursor-pointer" : ""}`}
    >
      <span
        aria-hidden="true"
        className="h-9 w-9 rounded-full grid place-items-center text-xs font-semibold text-white"
        style={{ backgroundColor: paletteFor(a.notificationId) }}
      >
        {initials(a.name)}
      </span>

      <div className="min-w-0">
        {hasNote ? (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className={`block w-full text-left rounded text-[15px] font-medium text-zinc-900 leading-snug ${FOCUS_RING}`}
          >
            {a.name}
          </button>
        ) : (
          <p className="text-[15px] font-medium text-zinc-900 leading-snug">{a.name}</p>
        )}
        {a.phone ? (
          <a
            href={`tel:${a.phone}`}
            onClick={(e) => e.stopPropagation()}
            className={`inline-block text-[13px] text-zinc-500 tabular-nums mt-px no-underline rounded ${FOCUS_RING}`}
          >
            {formatPhoneDisplay(a.phone)}
          </a>
        ) : !a.sharePhoneWithHost ? (
          <p className="text-[13px] text-zinc-400 mt-px">Number hidden</p>
        ) : null}
        {hasNote && (
          <p className={`text-xs text-zinc-500 mt-0.5 ${expanded ? "whitespace-pre-wrap break-words" : "truncate"}`}>
            &ldquo;{a.rsvpNote}&rdquo;
          </p>
        )}
      </div>

      <span
        aria-label={`Status: ${pill.label}`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${pill.cls}`}
      >
        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} />
        {pill.label}
      </span>

      <RowMenu
        name={a.name}
        open={menuOpen}
        onOpenChange={onMenuOpenChange}
        items={[
          {
            label: `Message ${firstName}`,
            href: a.phone ? `sms:${a.phone}` : undefined,
            disabled: !a.phone,
          },
          {
            label: "Copy number",
            onSelect: () => a.phone && onCopyNumber(a.phone),
            disabled: !a.phone,
          },
          { divider: true },
          ...(pending
            ? [
                { label: "Approve", onSelect: () => void onApprove(a) },
                { label: "Decline", onSelect: () => void onDecline(a), danger: true },
              ]
            : [{ label: "Remove from plan", onSelect: () => onRemove(a), danger: true }]),
        ]}
      />
    </li>
  );
}

type MenuItem =
  | { divider: true }
  | { label: string; onSelect?: () => void; href?: string; disabled?: boolean; danger?: boolean; divider?: false };

function RowMenu({
  name,
  open,
  onOpenChange,
  items,
}: {
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: MenuItem[];
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      onOpenChange(false);
    };
    document.addEventListener("mousedown", onDocClick);
    const first = menuRef.current?.querySelector<HTMLElement>("[role=menuitem]:not([aria-disabled=true])");
    first?.focus();
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open, onOpenChange]);

  const close = (refocus = true) => {
    onOpenChange(false);
    if (refocus) triggerRef.current?.focus();
  };

  const onMenuKeyDown = (e: ReactKeyboardEvent) => {
    const els = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([aria-disabled=true])") ?? [],
    );
    const idx = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      els[(idx + 1) % els.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      els[(idx - 1 + els.length) % els.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      els[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      els[els.length - 1]?.focus();
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`More options for ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className={`h-7 w-7 rounded-md grid place-items-center text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors ${FOCUS_RING}`}
      >
        <Ellipsis className="w-4 h-4" />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Options for ${name}`}
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full mt-1 z-20 min-w-44 rounded-lg border border-zinc-200 bg-white shadow-lg py-1"
        >
          {items.map((item, i) =>
            item.divider ? (
              <div key={i} role="separator" className="my-1 border-t border-zinc-100" />
            ) : item.href && !item.disabled ? (
              <a
                key={i}
                role="menuitem"
                href={item.href}
                onClick={() => close(false)}
                className={`block px-3 py-2 text-sm no-underline ${item.danger ? "text-red-600 hover:bg-red-50" : "text-zinc-800 hover:bg-zinc-50"} focus-visible:outline-none focus-visible:bg-zinc-100`}
              >
                {item.label}
              </a>
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                aria-disabled={item.disabled || undefined}
                disabled={item.disabled}
                onClick={() => {
                  close();
                  item.onSelect?.();
                }}
                className={`block w-full text-left px-3 py-2 text-sm disabled:opacity-40 ${item.danger ? "text-red-600 hover:bg-red-50" : "text-zinc-800 hover:bg-zinc-50"} focus-visible:outline-none focus-visible:bg-zinc-100`}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function ConfirmRemoveDialog({
  attendee,
  busy,
  onCancel,
  onConfirm,
}: {
  attendee: Attendee;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-900/50"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-attendee-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
      >
        <h3 id="remove-attendee-title" className="text-base font-semibold text-zinc-900">
          Remove {attendee.name}?
        </h3>
        <p className="mt-1.5 text-sm text-zinc-600">
          They&apos;ll lose their spot and won&apos;t be notified.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={`h-9 px-3.5 rounded-lg border border-zinc-300 bg-white text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50 ${FOCUS_RING}`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`h-9 px-3.5 rounded-lg bg-red-600 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 ${FOCUS_RING}`}
          >
            {busy ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}
