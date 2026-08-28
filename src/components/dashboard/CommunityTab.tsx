"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, MessageCircle, Search, UserMinus } from "lucide-react";
import type { OrgDashboard } from "./types";
import {
  buildRsvpCountIndex,
  rsvpCountForPerson,
  rsvpWindowDays,
  rsvpWindowLabel,
} from "./types";

// Community — Followers and Users merged into one list of people with a role
// column and segment filters, replacing the two separate tabs. Pending follow
// requests surface as their own segment (badged) instead of a separate table.

export type CommunitySegment = "everyone" | "never" | "repeat" | "hosts" | "pending";

interface Person {
  key: string;
  name: string;
  context: string;
  role: "owner" | "admin" | "host" | "follower";
  pending: boolean;
  calendarName: string | null;
  calendarId: string | null;
  rsvps: number | null;
  joinedAt: string | null;
  follower?: OrgDashboard["followers"][number];
  member?: OrgDashboard["members"][number];
  pendingFollower?: OrgDashboard["pendingFollowers"][number];
}

function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

function RoleChip({ role }: { role: Person["role"] }) {
  if (role === "owner" || role === "admin") {
    return (
      <span className="inline-block px-2 py-[3px] border border-zinc-300 text-zinc-900 rounded-[5px] text-[9px] font-semibold tracking-[0.08em] uppercase">
        {role === "owner" ? "Owner" : "Admin"}
      </span>
    );
  }
  if (role === "host") {
    return (
      <span className="inline-block px-2 py-[3px] bg-zinc-900 text-white rounded-[5px] text-[9px] font-semibold tracking-[0.08em] uppercase">
        Host
      </span>
    );
  }
  return (
    <span className="inline-block px-2 py-[3px] bg-zinc-100 text-zinc-600 rounded-[5px] text-[9px] font-semibold tracking-[0.08em] uppercase">
      Follower
    </span>
  );
}

export default function CommunityTab({
  dashboard,
  initialSegment,
  onApproveFollower,
  onRejectFollower,
  onRemoveFollower,
  onRemoveMember,
  onEditScope,
  onInviteCoHost,
  onNudge,
  onNudgeAll,
  nudgedIds,
}: {
  dashboard: OrgDashboard;
  initialSegment?: CommunitySegment;
  onApproveFollower: (pf: OrgDashboard["pendingFollowers"][number]) => void;
  onRejectFollower: (pf: OrgDashboard["pendingFollowers"][number]) => void;
  onRemoveFollower: (f: OrgDashboard["followers"][number]) => void;
  onRemoveMember: (m: OrgDashboard["members"][number]) => void;
  onEditScope: (m: OrgDashboard["members"][number]) => void;
  onInviteCoHost: (
    email: string,
    name: string,
    scope: { all: boolean; ids: string[] },
  ) => Promise<void>;
  onNudge: (f: OrgDashboard["followers"][number]) => void;
  /** Bulk form — every nudge-eligible follower in the current filtered view. */
  onNudgeAll: (fs: OrgDashboard["followers"][number][]) => void;
  /** Memberships nudged this session — their button collapses to "Nudged". */
  nudgedIds?: Set<string>;
}) {
  const [segment, setSegment] = useState<CommunitySegment>(
    initialSegment || "everyone",
  );
  const [search, setSearch] = useState("");
  const [calFilter, setCalFilter] = useState<string>("all");
  const [showInvite, setShowInvite] = useState(false);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteScopeAll, setInviteScopeAll] = useState(true);
  const [inviteScopeIds, setInviteScopeIds] = useState<string[]>([]);
  const [inviteScopeOpen, setInviteScopeOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState("");

  const rsvpIndex = useMemo(
    () => buildRsvpCountIndex(dashboard.rsvps),
    [dashboard.rsvps],
  );
  // Every RSVP number below is bounded by the server's plan window — say so
  // rather than letting "0" read as "never, ever".
  const windowLabel = rsvpWindowLabel(dashboard);
  const windowDays = rsvpWindowDays(dashboard);

  const people: Person[] = useMemo(() => {
    const out: Person[] = [];
    for (const m of dashboard.members) {
      const isOwnerRow = m.status === "Owned" || m.status === "Owner";
      const scopeLabel = isOwnerRow
        ? "Full access to every calendar"
        : m.scope?.allCalendars
          ? "Access to all calendars"
          : m.scope && m.scope.calendars.length > 0
            ? `Access to ${m.scope.calendars.map((c) => c.name).join(", ")}`
            : m.email || "";
      out.push({
        key: `m-${m.membershipId || m.objectId || m.email}`,
        name: m.name,
        context: m.pending ? "Pending invite" : m.email || scopeLabel,
        role: isOwnerRow ? "owner" : "host",
        pending: false,
        calendarName: isOwnerRow
          ? "All calendars"
          : m.scope?.allCalendars
            ? "All calendars"
            : m.scope && m.scope.calendars.length === 1
              ? m.scope.calendars[0].name
              : m.scope && m.scope.calendars.length > 1
                ? `${m.scope.calendars.length} calendars`
                : null,
        calendarId: null,
        rsvps: rsvpCountForPerson(rsvpIndex, { name: m.name }) || null,
        joinedAt: m.joinedAt,
        member: m,
      });
    }
    for (const f of dashboard.followers) {
      // Scoped to the calendar this follower actually follows — an org-wide
      // tally reads as "10 RSVPs" beside "Kinfolk Collective" when only one
      // of them happened there.
      const count = rsvpCountForPerson(rsvpIndex, f, f.calendarId);
      out.push({
        key: `f-${f.membershipId}`,
        name: f.name,
        context:
          count === 0
            ? `No RSVPs in ${windowLabel} · joined ${daysAgo(f.joinedAt)}`
            : `${count} RSVP${count === 1 ? "" : "s"} in ${windowLabel} · joined ${daysAgo(f.joinedAt)}`,
        role: "follower",
        pending: false,
        calendarName: f.calendarName,
        calendarId: f.calendarId,
        rsvps: count,
        joinedAt: f.joinedAt,
        follower: f,
      });
    }
    for (const pf of dashboard.pendingFollowers) {
      out.push({
        key: `p-${pf.membershipId}`,
        name: pf.name,
        context: `Requested ${daysAgo(pf.requestedAt)}`,
        role: "follower",
        pending: true,
        calendarName: pf.calendarName,
        calendarId: pf.calendarId,
        rsvps: null,
        joinedAt: null,
        pendingFollower: pf,
      });
    }
    return out;
  }, [dashboard.members, dashboard.followers, dashboard.pendingFollowers, rsvpIndex, windowLabel]);

  const counts = useMemo(
    () => ({
      everyone: people.filter((p) => !p.pending).length,
      never: people.filter(
        (p) => !p.pending && p.role === "follower" && p.rsvps === 0,
      ).length,
      repeat: people.filter((p) => !p.pending && (p.rsvps || 0) >= 2).length,
      hosts: people.filter(
        (p) => !p.pending && (p.role === "host" || p.role === "owner"),
      ).length,
      pending: people.filter((p) => p.pending).length,
    }),
    [people],
  );

  const filtered = useMemo(() => {
    let list = people;
    if (segment === "everyone") list = list.filter((p) => !p.pending);
    else if (segment === "never")
      list = list.filter(
        (p) => !p.pending && p.role === "follower" && p.rsvps === 0,
      );
    else if (segment === "repeat")
      list = list.filter((p) => !p.pending && (p.rsvps || 0) >= 2);
    else if (segment === "hosts")
      list = list.filter(
        (p) => !p.pending && (p.role === "host" || p.role === "owner"),
      );
    else if (segment === "pending") list = list.filter((p) => p.pending);
    if (calFilter !== "all")
      list = list.filter(
        (p) => p.calendarId === calFilter || p.calendarName === "All calendars",
      );
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
    return list;
  }, [people, segment, calFilter, search]);

  // Nudging lives on the "No recent RSVPs" segment only — it's a re-engagement
  // tool, not a general broadcast channel. Eligible = has a phone on file and
  // hasn't been nudged this session.
  const nudgingHere = segment === "never";
  const nudgeable = useMemo(
    () =>
      nudgingHere
        ? filtered
            .filter(
              (p) =>
                !p.pending &&
                p.follower?.phone &&
                !nudgedIds?.has(p.follower.membershipId),
            )
            .map((p) => p.follower!)
        : [],
    [nudgingHere, filtered, nudgedIds],
  );

  const exportCsv = () => {
    const header = `Name,Role,Calendar,RSVPs (last ${windowDays} days),Joined`;
    const rows = filtered.map(
      (p) =>
        `"${p.name}","${p.pending ? "Pending" : p.role}","${p.calendarName || ""}","${p.rsvps ?? ""}","${p.joinedAt ? new Date(p.joinedAt).toLocaleDateString() : ""}"`,
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dashboard.name}-community.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
    if (!inviteScopeAll && inviteScopeIds.length === 0) {
      alert("Pick at least one calendar, or choose All Calendars.");
      return;
    }
    setInviting(true);
    setInviteSuccess("");
    try {
      await onInviteCoHost(inviteEmail, inviteName, {
        all: inviteScopeAll,
        ids: inviteScopeIds,
      });
      setInviteSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setInviteName("");
      setInviteScopeAll(true);
      setInviteScopeIds([]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setInviting(false);
    }
  };

  const segments: { id: CommunitySegment; label: string; count: number }[] = [
    { id: "everyone", label: "Everyone", count: counts.everyone },
    { id: "never", label: "No recent RSVPs", count: counts.never },
    { id: "repeat", label: "Repeat", count: counts.repeat },
    { id: "hosts", label: "Hosts", count: counts.hosts },
    ...(counts.pending > 0
      ? [{ id: "pending" as const, label: "Pending", count: counts.pending }]
      : []),
  ];

  return (
    <div>
      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 lg:py-5 border-b border-zinc-100 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[180px]">
          <h1 className="text-lg lg:text-xl font-semibold tracking-[-0.01em] text-zinc-900">
            Community
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {dashboard.followerCount} follower
            {dashboard.followerCount === 1 ? "" : "s"} ·{" "}
            {dashboard.members.length} member
            {dashboard.members.length === 1 ? "" : "s"}
            {counts.never > 0 &&
              ` · ${counts.never} with no RSVPs in ${windowLabel}`}
          </p>
        </div>
        <div className="relative hidden md:block">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people"
            className="h-9 w-48 pl-9 pr-4 border border-zinc-200 rounded-full text-xs focus:outline-none focus:border-zinc-900 placeholder:text-zinc-400"
          />
        </div>
        {dashboard.isOwner && (
          <button
            onClick={() => setShowInvite((v) => !v)}
            className="h-9 px-4 bg-zinc-900 text-white rounded-full text-xs font-medium hover:bg-zinc-800 transition-colors"
          >
            Invite a co-host
          </button>
        )}
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-5">
        {/* Invite co-host panel */}
        {showInvite && dashboard.isOwner && (
          <div className="border border-zinc-200 rounded-xl p-4 sm:p-5 mb-5">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-zinc-500 uppercase mb-1">
              Invite a co-host
            </p>
            <p className="text-xs text-zinc-500 mb-4">
              Co-hosts can create plans, view RSVPs, and help manage the
              calendar.
            </p>
            {inviteSuccess && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-300 text-emerald-800 px-4 py-2.5 rounded-xl mb-4 text-[13px] font-medium">
                <Check className="w-4 h-4" /> {inviteSuccess}
              </div>
            )}
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[180px]">
                <label className="text-[9px] font-semibold tracking-[0.12em] uppercase text-zinc-400 block mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full h-[38px] border border-zinc-200 rounded-lg px-3 text-sm focus:outline-none focus:border-zinc-900"
                  placeholder="cohost@example.com"
                />
              </div>
              <div className="w-52 relative">
                <label className="text-[9px] font-semibold tracking-[0.12em] uppercase text-zinc-400 block mb-1.5">
                  Calendars
                </label>
                <button
                  type="button"
                  onClick={() => setInviteScopeOpen((o) => !o)}
                  className="w-full h-[38px] border border-zinc-200 rounded-lg px-3 text-sm text-left flex items-center justify-between gap-2 focus:outline-none focus:border-zinc-900"
                >
                  <span className="truncate">
                    {inviteScopeAll
                      ? "All Calendars"
                      : inviteScopeIds.length === 0
                        ? "Select calendars…"
                        : inviteScopeIds.length === 1
                          ? dashboard.calendars.find(
                              (c) => c.objectId === inviteScopeIds[0],
                            )?.name || "1 calendar"
                          : `${inviteScopeIds.length} calendars`}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform ${inviteScopeOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {inviteScopeOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setInviteScopeOpen(false)}
                    />
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setInviteScopeAll(true);
                          setInviteScopeIds([]);
                        }}
                        className={`w-full px-3 py-2 text-sm text-left hover:bg-zinc-50 flex items-center gap-2 border-b border-zinc-100 ${inviteScopeAll ? "text-zinc-900 font-medium" : "text-zinc-600"}`}
                      >
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${inviteScopeAll ? "bg-zinc-900 border-zinc-900" : "border-zinc-300"}`}
                        >
                          {inviteScopeAll && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </span>
                        All Calendars
                      </button>
                      {dashboard.calendars.map((cal) => {
                        const selected =
                          !inviteScopeAll &&
                          inviteScopeIds.includes(cal.objectId);
                        return (
                          <button
                            key={cal.objectId}
                            type="button"
                            onClick={() => {
                              setInviteScopeAll(false);
                              setInviteScopeIds((prev) =>
                                prev.includes(cal.objectId)
                                  ? prev.filter((id) => id !== cal.objectId)
                                  : [...prev, cal.objectId],
                              );
                            }}
                            className={`w-full px-3 py-2 text-sm text-left hover:bg-zinc-50 flex items-center gap-2 ${selected ? "text-zinc-900 font-medium" : "text-zinc-600"}`}
                          >
                            <span
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected ? "bg-zinc-900 border-zinc-900" : "border-zinc-300"}`}
                            >
                              {selected && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </span>
                            <span className="truncate">{cal.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
              <div className="w-40">
                <label className="text-[9px] font-semibold tracking-[0.12em] uppercase text-zinc-400 block mb-1.5">
                  Name (optional)
                </label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full h-[38px] border border-zinc-200 rounded-lg px-3 text-sm focus:outline-none focus:border-zinc-900"
                  placeholder="Name"
                />
              </div>
              <button
                onClick={handleInvite}
                disabled={
                  !inviteEmail ||
                  inviting ||
                  (!inviteScopeAll && inviteScopeIds.length === 0)
                }
                className="h-[38px] px-4 bg-zinc-900 text-white rounded-full text-xs font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:pointer-events-none shrink-0"
              >
                {inviting ? "Sending…" : "Send invite"}
              </button>
            </div>
          </div>
        )}

        {/* Mobile search */}
        <div className="relative md:hidden mb-3">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people"
            className="h-10 w-full pl-9 pr-4 border border-zinc-200 rounded-full text-sm focus:outline-none focus:border-zinc-900 placeholder:text-zinc-400"
          />
        </div>

        {/* Segment chips + filters */}
        <div className="flex flex-wrap gap-2 items-center mb-3.5">
          {segments.map((s) => (
            <button
              key={s.id}
              onClick={() => setSegment(s.id)}
              className={`px-3.5 py-2 rounded-full text-xs font-medium transition-colors ${
                segment === s.id
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-200 text-zinc-600 hover:border-zinc-300"
              } ${s.id === "pending" && segment !== "pending" ? "border-amber-300 text-amber-700" : ""}`}
            >
              {s.label} {s.count}
            </button>
          ))}
          <span className="flex-1" />
          {dashboard.calendars.length > 1 && (
            <select
              value={calFilter}
              onChange={(e) => setCalFilter(e.target.value)}
              className="text-xs border border-zinc-200 rounded-full px-3 py-2 text-zinc-600 focus:outline-none focus:border-zinc-400 bg-white"
            >
              <option value="all">All calendars</option>
              {dashboard.calendars
                .filter((c) => c.isActive)
                .map((cal) => (
                  <option key={cal.objectId} value={cal.objectId}>
                    {cal.name}
                  </option>
                ))}
            </select>
          )}
          {nudgeable.length > 1 && calFilter !== "all" && (
            <button
              onClick={() => onNudgeAll(nudgeable)}
              className="px-3.5 py-2 rounded-full text-xs font-medium border border-zinc-200 text-zinc-600 hover:border-zinc-300 transition-colors inline-flex items-center gap-1.5"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Nudge all {nudgeable.length}
            </button>
          )}
          <button
            onClick={exportCsv}
            className="px-3.5 py-2 rounded-full text-xs font-medium border border-zinc-200 text-zinc-600 hover:border-zinc-300 transition-colors"
          >
            Export CSV
          </button>
        </div>

        {/* People table */}
        {filtered.length === 0 ? (
          <div className="border border-zinc-200 rounded-xl p-8 text-center">
            <p className="text-sm font-medium text-zinc-900 mb-1">
              {search || segment !== "everyone"
                ? "Nobody matches"
                : "No people yet"}
            </p>
            <p className="text-xs text-zinc-500">
              {search || segment !== "everyone"
                ? "Try a different segment or clear the search."
                : "Share your calendar link to get followers."}
            </p>
          </div>
        ) : (
          <div
            className="border border-zinc-200 rounded-xl overflow-hidden"
          >
            {/* Header strip — desktop only */}
            <div className="hidden md:flex gap-3.5 px-[18px] py-[9px] bg-zinc-50 border-b border-zinc-100 text-[9px] font-semibold tracking-[0.12em] uppercase text-zinc-400">
              <span className="flex-1">Name</span>
              <span className="w-[100px]">Role</span>
              <span className="w-[150px]">Calendar</span>
              <span
                className="w-[70px] text-right"
                title={`RSVPs in ${windowLabel}`}
              >
                RSVPs {windowDays}d
              </span>
              <span className="w-[80px] text-right">Joined</span>
              <span className="w-[130px]" />
            </div>
            {filtered.map((p) => (
              <div
                key={p.key}
                className={`flex flex-wrap md:flex-nowrap items-center gap-3 md:gap-3.5 px-4 md:px-[18px] py-3 border-b border-zinc-100 last:border-b-0 ${p.pending ? "bg-amber-50/40" : "hover:bg-zinc-50"} transition-colors`}
              >
                <div className="flex-1 min-w-[160px] flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-zinc-200 flex items-center justify-center shrink-0 text-[11px] font-semibold text-zinc-500">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-zinc-900 truncate">
                      {p.name}
                    </p>
                    <p className="text-[11px] text-zinc-400 truncate">
                      {p.context}
                    </p>
                  </div>
                </div>
                <div className="w-auto md:w-[100px] shrink-0">
                  {p.pending ? (
                    <span className="inline-block px-2 py-[3px] bg-amber-100 text-amber-700 rounded-[5px] text-[9px] font-semibold tracking-[0.08em] uppercase">
                      Pending
                    </span>
                  ) : (
                    <RoleChip role={p.role} />
                  )}
                </div>
                <span className="hidden md:block w-[150px] text-xs text-zinc-700 truncate shrink-0">
                  {p.calendarName || "—"}
                </span>
                <span
                  className={`hidden md:block w-[70px] text-right text-[13px] font-medium shrink-0 ${p.rsvps ? "text-zinc-900" : "text-zinc-400"}`}
                >
                  {p.rsvps ?? "—"}
                </span>
                <span className="hidden md:block w-[80px] text-right text-xs text-zinc-400 shrink-0">
                  {p.joinedAt ? new Date(p.joinedAt).toLocaleDateString() : "—"}
                </span>
                <div className="w-auto md:w-[130px] shrink-0 flex items-center justify-end gap-2 ml-auto">
                  {p.pending && p.pendingFollower && (
                    <>
                      <button
                        onClick={() => onApproveFollower(p.pendingFollower!)}
                        className="px-3 py-1.5 min-h-[32px] bg-zinc-900 text-white rounded-full text-[11px] font-medium hover:bg-zinc-800 transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => onRejectFollower(p.pendingFollower!)}
                        className="px-3 py-1.5 min-h-[32px] border border-zinc-300 text-zinc-700 rounded-full text-[11px] font-medium hover:bg-white transition-colors"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {!p.pending && p.member && p.role === "host" && dashboard.isOwner && (
                    <button
                      onClick={() => onEditScope(p.member!)}
                      className="text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
                    >
                      Manage
                    </button>
                  )}
                  {!p.pending &&
                    p.member &&
                    p.role !== "owner" &&
                    dashboard.isOwner && (
                      <button
                        onClick={() => onRemoveMember(p.member!)}
                        className="text-zinc-400 hover:text-red-500 transition-colors"
                        title="Remove user"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    )}
                  {nudgingHere &&
                    !p.pending &&
                    p.follower &&
                    p.follower.phone &&
                    (nudgedIds?.has(p.follower.membershipId) ? (
                      <span className="text-[11px] font-medium text-zinc-400">
                        Nudged
                      </span>
                    ) : (
                      <button
                        onClick={() => onNudge(p.follower!)}
                        className="text-zinc-400 hover:text-zinc-900 transition-colors"
                        title="Text a personal nudge"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    ))}
                  {!p.pending && p.follower && (
                    <button
                      onClick={() => onRemoveFollower(p.follower!)}
                      className="text-zinc-400 hover:text-red-500 transition-colors"
                      title="Remove follower"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {filtered.length > 0 && (
          <p className="text-xs text-zinc-400 mt-3.5">
            Showing {filtered.length} of {people.length}
          </p>
        )}
      </div>
    </div>
  );
}
