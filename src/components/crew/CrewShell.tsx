"use client";

/**
 * Shared frame for the /crew pages: phone-first, one top bar, and human
 * sentences for every dead state (an expired link is not a 404).
 *
 * Look: the dark Friend Mode palette (`fm-*` colors in globals.css), serif
 * display type over Manrope, cream primary buttons. Lime stays on the
 * switch's "on" state only. `wide` pages (the crew page and its book) get a
 * desktop layout from `lg` up; everything else stays one narrow column.
 */

import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";
import { FriendModeMark } from "@/components/crew/FriendModeGlyphs";
import { crewHref, type CrewAuth } from "@/lib/crew";

/**
 * True inside the iOS app's crew web view (it appends "LeafApp/ios" to its
 * user agent). The app's own nav bar already shows the crew's name and a
 * back button, so the pages drop their top bar and back link there.
 */
export function useInApp() {
  return useSyncExternalStore(
    () => () => {},
    () => /LeafApp\//.test(navigator.userAgent),
    () => false,
  );
}

export function CrewShell({ children, wide = false, topBar }: { children: ReactNode; wide?: boolean; topBar?: ReactNode }) {
  const inApp = useInApp();
  // `fm` keeps the older light-utility re-maps working for shared bits
  // (VenueSearch's dropdown, form fields) that aren't written in fm-* colors.
  return (
    <div className="fm min-h-screen bg-fm-canvas font-fm-sans text-fm-ink">
      {!inApp && topBar}
      <main className={`mx-auto px-5 pb-24 ${wide ? "max-w-lg pt-5 lg:max-w-[1344px] lg:px-12 lg:pt-14" : "max-w-lg pt-8"} ${inApp ? "pt-2" : ""}`}>{children}</main>
    </div>
  );
}

/** Friend Mode mark on the left; on desktop, Crew / The book tabs in the middle. */
export function CrewTopBar({ auth, active }: { auth: CrewAuth; active: "crew" | "book" }) {
  const tab = (key: "crew" | "book", label: string, href: string) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={`flex h-9 items-center rounded-full px-[18px] text-sm ${
        active === key ? "bg-fm-ink font-semibold text-fm-canvas" : "font-medium text-fm-ink-2 hover:text-fm-ink"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <header className="mx-auto flex h-14 max-w-lg items-center justify-between px-5 pt-3.5 lg:h-[72px] lg:max-w-none lg:border-b lg:border-fm-line-dim lg:px-12 lg:pt-0">
      <div className="flex items-center gap-2.5 lg:w-44">
        <FriendModeMark width={36} />
        <Mono className="text-fm-muted">Friend Mode</Mono>
      </div>
      <nav aria-label="Crew" className="hidden gap-1 rounded-full border border-fm-line-dim bg-fm-surface p-1 lg:flex">
        {tab("crew", "Crew", crewHref(auth))}
        {tab("book", "The book", crewHref(auth, "book"))}
      </nav>
      <div className="hidden lg:block lg:w-44" />
    </header>
  );
}

/** Small monospace uppercase label. */
export function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-fm-mono text-[11px] font-medium uppercase tracking-[0.08em] ${className}`}>{children}</span>;
}

/** Serif display title; `italic` is the second, softer line. */
export function DisplayTitle({ children, italic }: { children: ReactNode; italic?: ReactNode }) {
  return (
    <h1 className="m-0 font-fm-serif text-[52px] font-normal leading-[0.98] tracking-[-0.01em] lg:text-[76px] lg:leading-[0.95]">
      {children}
      {italic && <> <span className="italic text-fm-ink-2">{italic}</span></>}
    </h1>
  );
}

export function SectionTitle({ children, as: Tag = "h2" }: { children: ReactNode; as?: "h2" | "h3" }) {
  return <Tag className="m-0 font-fm-serif text-[28px] font-normal leading-tight lg:text-4xl">{children}</Tag>;
}

export function DeadState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <CrewShell>
      <div className="flex min-h-[70vh] flex-col justify-center gap-7">
        <div className="flex flex-col gap-3.5">
          <h1 className="m-0 font-fm-serif text-[46px] font-normal leading-none">{title}</h1>
          <p className="m-0 text-base leading-relaxed text-fm-ink-2">{body}</p>
        </div>
        {action && <div>{action}</div>}
      </div>
    </CrewShell>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[28px] border border-fm-line-dim bg-fm-surface p-5 lg:p-7 ${className}`}>{children}</section>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <Mono className="block text-fm-muted">{children}</Mono>;
}

export function Button({
  children,
  onClick,
  href,
  kind = "primary",
  disabled,
  small,
  block,
  type = "button",
  pressed,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  kind?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  small?: boolean;
  block?: boolean;
  type?: "button" | "submit";
  pressed?: boolean;
}) {
  const base = `inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition disabled:opacity-50 ${
    small ? "h-10 px-4 text-sm" : "h-[52px] px-5 text-[15px]"
  } ${block ? "w-full" : ""}`;
  const look =
    kind === "primary"
      ? "bg-fm-ink text-fm-canvas hover:bg-white"
      : kind === "danger"
        ? "text-fm-danger hover:bg-fm-surface"
        : "border border-fm-line text-fm-ink hover:bg-fm-surface";
  if (href) {
    return (
      <Link href={href} className={`${base} ${look}`}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} aria-pressed={pressed} className={`${base} ${look}`}>
      {children}
    </button>
  );
}

/** Initials on a round tile; `invited` draws it dashed. */
export function Avatar({ name, src, size = 32, invited, ring }: { name: string; src?: string | null; size?: number; invited?: boolean; ring?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  if (src && !invited) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" style={style} className={`shrink-0 rounded-full object-cover ${ring || ""}`} />;
  }
  return (
    <span
      aria-hidden
      style={style}
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${
        invited ? "border-2 border-dashed border-fm-line text-fm-muted" : "bg-fm-line text-fm-ink"
      } ${ring || ""}`}
    >
      {initials}
    </span>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="fm flex min-h-screen items-center justify-center bg-fm-canvas font-fm-sans text-sm text-fm-muted">{label}</div>
  );
}
