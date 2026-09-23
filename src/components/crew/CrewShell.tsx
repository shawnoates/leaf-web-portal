"use client";

/**
 * Shared frame for the /crew pages: a narrow phone-first column, one header,
 * and human sentences for every dead state (an expired link is not a 404).
 */

import Link from "next/link";
import type { ReactNode } from "react";

export function CrewShell({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-lg px-5 py-8 pb-24">{children}</main>;
}

export function CrewHeader({
  crewName,
  subtitle,
  backHref,
  backLabel,
}: {
  crewName: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="mb-6">
      {backHref && (
        <Link href={backHref} className="text-sm text-leaf-600 hover:underline">
          ← {backLabel || "Back"}
        </Link>
      )}
      <div className="mt-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-leaf-600">
        <span aria-hidden>🍃</span> Friend Mode
      </div>
      <h1 className="mt-1 text-2xl font-semibold text-leaf-900">{crewName}</h1>
      {subtitle && <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>}
    </header>
  );
}

export function DeadState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <CrewShell>
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
        <h1 className="text-xl font-semibold text-leaf-900">{title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-zinc-700">{body}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </CrewShell>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm ${className}`}>{children}</section>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{children}</div>;
}

export function Button({
  children,
  onClick,
  href,
  kind = "primary",
  disabled,
  small,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  kind?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  small?: boolean;
  type?: "button" | "submit";
}) {
  const base = `inline-flex items-center justify-center rounded-full font-medium transition ${
    small ? "px-3 py-1.5 text-sm" : "px-4 py-2.5 text-[15px]"
  } disabled:opacity-50`;
  const look =
    kind === "primary"
      ? "bg-leaf-800 text-white hover:bg-leaf-700"
      : kind === "danger"
        ? "border border-red-200 text-red-700 hover:bg-red-50"
        : "border border-zinc-300 text-leaf-900 hover:bg-zinc-50";
  if (href) {
    return (
      <Link href={href} className={`${base} ${look}`}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${look}`}>
      {children}
    </button>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return <div className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-400">{label}</div>;
}
