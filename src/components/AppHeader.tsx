"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, HelpCircle, LogOut } from "lucide-react";
import Parse from "@/lib/parse-client";
import OwnerInbox from "./OwnerInbox";

// The dashboard's top bar, reusable on full-page surfaces that sit outside the
// dashboard route (the inbox today). Keeping the same header there means those
// pages read as part of the app rather than somewhere you got navigated off to
// — the inbox icon, Help and Log out stay exactly where they were.
//
// `showInbox` is off on the inbox itself: an icon that links to the page you're
// already on is noise.
export default function AppHeader({
  title,
  subtitle,
  showBack = false,
  showInbox = true,
}: {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  showInbox?: boolean;
}) {
  const router = useRouter();

  async function handleLogout() {
    try {
      await Parse.User.logOut();
    } catch {
      // ignore
    }
    router.push("/");
  }

  return (
    <header className="border-b border-zinc-100 bg-white shrink-0">
      <div className="max-w-5xl mx-auto px-6 py-5 flex items-center gap-4">
        {showBack && (
          <button
            onClick={() => router.back()}
            className="p-1.5 -ml-1.5 text-zinc-400 hover:text-zinc-900 rounded-full hover:bg-zinc-100 shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-medium tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-xs text-zinc-400">{subtitle}</p>}
        </div>
        {showInbox && <OwnerInbox />}
        <Link
          href="/help"
          target="_blank"
          className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-zinc-400 hover:text-zinc-900 transition-colors shrink-0"
          title="Help Center"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Help</span>
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-zinc-400 hover:text-zinc-900 transition-colors shrink-0"
          title="Log out"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Log out</span>
        </button>
      </div>
    </header>
  );
}
