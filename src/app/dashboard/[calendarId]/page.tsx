"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import CityAutocomplete from "@/components/CityAutocomplete";
import SubscriptionModal from "@/components/SubscriptionModal";
import {
  Calendar,
  Check,
  ChevronRight,
  Download,
  ExternalLink,
  ImagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  Users,
  Lock,
  CreditCard,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────

interface OrgDashboard {
  objectId: string;
  name: string;
  description: string;
  shareId: string;
  orgType: string | null;
  tier: string;
  profilePhoto: string | null;
  bannerUrl: string | null;
  brandColor: string;
  daysOfWeek: number[];
  blacklistCategories: string[];
  locationTypes: string[];
  cities: string[];
  planIdeasPerWeek: number;
  website: string;
  memberCount: number;
  totalRsvpCount: number;
  rsvpLimit: number | null;
  planIdeaCount: number;
  upcomingPlanCount: number;
  members: {
    objectId: string | null;
    name: string;
    email: string | null;
    status: string;
    joinedAt: string;
  }[];
  rsvps: {
    objectId: string;
    name: string;
    phone: string | null;
    planTitle: string;
    date: string;
    source: string;
  }[];
  calendars: {
    objectId: string;
    name: string;
    shareId: string;
    city: string;
    isPrimary: boolean;
  }[];
  calendarLimit: number | null;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TABS = [
  { id: "overview", label: "Overview", icon: Calendar },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "members", label: "Members", icon: Users },
  { id: "subscription", label: "Subscription", icon: CreditCard },
];

// ── Component ──────────────────────────────────────────────────────────

export default function OrgDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const calendarId = params.calendarId as string;

  const [user, setUser] = useState<Parse.User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [dashboard, setDashboard] = useState<OrgDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Edit states
  const [editName, setEditName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [descValue, setDescValue] = useState("");
  const [saving, setSaving] = useState(false);

  // Settings states
  const [settingsDaysOfWeek, setSettingsDaysOfWeek] = useState<number[]>([]);
  const [settingsBrandColor, setSettingsBrandColor] = useState("#18181b");
  const [settingsLogoPreview, setSettingsLogoPreview] = useState<string | null>(null);
  const [settingsLogoBase64, setSettingsLogoBase64] = useState<string | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  // Modals
  const [showAddCalendar, setShowAddCalendar] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);

  // Add calendar form
  const [newCalName, setNewCalName] = useState("");
  const [newCalDesc, setNewCalDesc] = useState("");
  const [newCalCity, setNewCalCity] = useState("");
  const [newCalCitySelected, setNewCalCitySelected] = useState(false);
  const [addingCalendar, setAddingCalendar] = useState(false);

  // Regenerate (per calendar)
  const [regeneratingCalId, setRegeneratingCalId] = useState<string | null>(null);

  // Co-host invite
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState("");

  useEffect(() => {
    try {
      const current = Parse.User.current();
      if (current) setUser(current);
    } catch {
      // No session
    }
    setAuthChecked(true);
  }, []);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const result = await Parse.Cloud.run("getOrgDashboard", { calendarId });
      setDashboard(result);
      setNameValue(result.name);
      setDescValue(result.description);
      setSettingsDaysOfWeek(result.daysOfWeek);
      setSettingsBrandColor(result.brandColor);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load dashboard";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [calendarId]);

  useEffect(() => {
    if (user) fetchDashboard();
  }, [user, fetchDashboard]);

  // ── Handlers ──

  async function handleSaveOverview() {
    setSaving(true);
    try {
      await Parse.Cloud.run("updateOrganization", {
        calendarId,
        name: nameValue,
        description: descValue,
      });
      setDashboard((d) => d ? { ...d, name: nameValue, description: descValue } : d);
      setEditName(false);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSettings() {
    setSettingsSaving(true);
    try {
      const params: Record<string, unknown> = {
        calendarId,
        brandColor: settingsBrandColor,
        daysOfWeek: settingsDaysOfWeek,
      };
      if (settingsLogoBase64) {
        params.profilePhotoBase64 = settingsLogoBase64;
      }
      await Parse.Cloud.run("updateOrganization", params);
      setDashboard((d) => {
        if (!d) return d;
        return {
          ...d,
          brandColor: settingsBrandColor,
          daysOfWeek: settingsDaysOfWeek,
          profilePhoto: settingsLogoPreview || d.profilePhoto,
        };
      });
      setSettingsLogoBase64(null);
      setToast("Settings saved");
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      console.error("Save settings failed:", err);
      setToast("Failed to save settings");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSettingsSaving(false);
    }
  }

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setSettingsLogoPreview(result);
      // Strip the data:image/...;base64, prefix for Parse
      setSettingsLogoBase64(result.split(",")[1]);
    };
    reader.readAsDataURL(file);
  }

  async function handleAddCalendar() {
    if (!newCalName || !newCalCity || !newCalCitySelected) return;
    setAddingCalendar(true);
    try {
      await Parse.Cloud.run("createCalendarUnderOrg", {
        organizationId: calendarId,
        name: newCalName,
        description: newCalDesc,
        city: newCalCity,
      });
      setShowAddCalendar(false);
      setNewCalName("");
      setNewCalDesc("");
      setNewCalCity("");
      setNewCalCitySelected(false);
      fetchDashboard();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add calendar";
      alert(message);
    } finally {
      setAddingCalendar(false);
    }
  }

  async function handleSubscriptionChange(tier: string) {
    setSubscriptionLoading(true);
    try {
      await Parse.Cloud.run("updateOrgSubscription", { calendarId, tier });
      setShowSubscription(false);
      fetchDashboard();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update subscription";
      alert(message);
    } finally {
      setSubscriptionLoading(false);
    }
  }

  async function handleCancelSubscription() {
    if (!confirm("Are you sure you want to cancel your subscription? You will be downgraded to Starter (Free).")) return;
    setSubscriptionLoading(true);
    try {
      await Parse.Cloud.run("updateOrgSubscription", { calendarId, cancel: true });
      fetchDashboard();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to cancel";
      alert(message);
    } finally {
      setSubscriptionLoading(false);
    }
  }

  async function handleDelete() {
    try {
      await Parse.Cloud.run("deleteOrganization", { calendarId });
      router.push("/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete";
      alert(message);
    }
  }

  async function handleRegenerate(targetCalendarId: string) {
    setRegeneratingCalId(targetCalendarId);
    try {
      await Parse.Cloud.run("generateCalendarPlansForOne", {
        calendarId: targetCalendarId,
        count: 3,
      });
      // Wait a moment for background generation
      setTimeout(() => {
        fetchDashboard();
        setRegeneratingCalId(null);
      }, 3000);
    } catch (err) {
      console.error("Regenerate failed:", err);
      setRegeneratingCalId(null);
    }
  }

  async function handleInviteCoHost() {
    if (!inviteEmail) return;
    setInviting(true);
    setInviteSuccess("");
    try {
      await Parse.Cloud.run("inviteCoHost", {
        calendarId,
        email: inviteEmail,
        name: inviteName,
      });
      setInviteSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setInviteName("");
      fetchDashboard();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send invite";
      alert(message);
    } finally {
      setInviting(false);
    }
  }

  function exportRsvpsCsv() {
    if (!dashboard) return;
    const header = "Name,Phone,Plan,Date,Source";
    const rows = dashboard.rsvps.map(
      (r) => `"${r.name}","${r.phone || ""}","${r.planTitle}","${new Date(r.date).toLocaleDateString()}","${r.source}"`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dashboard.name}-rsvps.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Auth gate ──

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="max-w-sm w-full text-center">
          <h1 className="text-2xl font-light tracking-tight mb-2">Sign in to continue</h1>
          <p className="text-sm text-zinc-500 mb-8">You need to sign in to access the dashboard.</p>
          <GoogleSignInButton onSignIn={(u) => setUser(u)} onError={(err) => console.error(err)} />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <p className="text-zinc-500 mb-4">{error || "Organization not found."}</p>
        <Link href="/dashboard" className="text-sm underline">Back to Dashboard</Link>
      </div>
    );
  }

  const isGrowthPlus = dashboard.tier === "growth" || dashboard.tier === "pro";
  const tierLabel = dashboard.tier === "pro" ? "Pro" : dashboard.tier === "growth" ? "Growth" : "Starter";

  // ── Render ──

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-zinc-100">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-medium tracking-tight truncate">{dashboard.name}</h1>
            <p className="text-xs text-zinc-400">
              {tierLabel} Plan &middot; {dashboard.memberCount} members
            </p>
          </div>
          <Link
            href={`/org/${dashboard.shareId}`}
            target="_blank"
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            View Public Page <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-6">
          <nav className="flex gap-1 -mb-px overflow-x-auto no-scrollbar">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const isLocked =
                (tab.id === "settings" || tab.id === "members") && !isGrowthPlus;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (isLocked) {
                      setShowSubscription(true);
                    } else {
                      setActiveTab(tab.id);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? "border-zinc-900 text-zinc-900"
                      : "border-transparent text-zinc-400 hover:text-zinc-600"
                  }`}
                >
                  {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* ──────── OVERVIEW TAB ──────── */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* Name & Description */}
            <section className="border border-zinc-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
                  Organization Details
                </h2>
                {!editName ? (
                  <button
                    onClick={() => setEditName(true)}
                    className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditName(false); setNameValue(dashboard.name); setDescValue(dashboard.description); }}
                      className="text-xs text-zinc-500 hover:text-zinc-900"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveOverview}
                      disabled={saving}
                      className="flex items-center gap-1 text-xs bg-zinc-900 text-white px-3 py-1.5 rounded-lg hover:bg-zinc-800 disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </div>
                )}
              </div>
              {editName ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Name</label>
                    <input
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      className="w-full border-b border-zinc-300 py-2 text-lg font-light focus:outline-none focus:border-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Description</label>
                    <textarea
                      value={descValue}
                      onChange={(e) => setDescValue(e.target.value)}
                      rows={3}
                      className="w-full border border-zinc-200 rounded-lg p-3 text-sm font-light focus:outline-none focus:border-zinc-400 resize-none"
                    />
                  </div>
                  {/* Danger Zone — only visible in edit mode */}
                  <div className="pt-4 border-t border-red-100 mt-4">
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-500 hover:text-red-700 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete Organization
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-xl font-light tracking-tight mb-1">{dashboard.name}</h3>
                  <p className="text-sm text-zinc-500">{dashboard.description || "No description"}</p>
                </div>
              )}
            </section>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Members", value: dashboard.memberCount },
                { label: "Plan RSVPs", value: `${dashboard.totalRsvpCount}${dashboard.rsvpLimit ? `/${dashboard.rsvpLimit}` : ""}` },
                { label: "Active Plans", value: dashboard.upcomingPlanCount },
                { label: "Plan Ideas", value: dashboard.planIdeaCount },
              ].map((stat) => (
                <div key={stat.label} className="border border-zinc-200 rounded-xl p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">{stat.label}</p>
                  <p className="text-2xl font-light">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/dashboard/${calendarId}/plans`}
                className="flex items-center gap-2 border border-zinc-200 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:border-zinc-300 transition-colors"
              >
                <Plus className="w-4 h-4" /> Create Plan
              </Link>
            </div>

            {/* Calendars */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
                  Calendars ({dashboard.calendars.length}{dashboard.calendarLimit ? `/${dashboard.calendarLimit}` : ""})
                </h2>
                {isGrowthPlus && (
                  <button
                    onClick={() => {
                      if (dashboard.calendarLimit && dashboard.calendars.length >= dashboard.calendarLimit) {
                        setShowSubscription(true);
                      } else {
                        setShowAddCalendar(true);
                      }
                    }}
                    className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors"
                  >
                    {dashboard.calendarLimit && dashboard.calendars.length >= dashboard.calendarLimit ? (
                      <><Lock className="w-3.5 h-3.5" /> Upgrade to Add</>
                    ) : (
                      <><Plus className="w-3.5 h-3.5" /> Add Calendar</>
                    )}
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {dashboard.calendars.map((cal) => (
                  <div
                    key={cal.objectId}
                    className="border border-zinc-200 rounded-xl p-5 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{cal.name}</h3>
                        {cal.isPrimary && (
                          <span className="text-[10px] font-bold uppercase tracking-widest bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full">
                            Primary
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400">{cal.city || "No city set"}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => {
                          if (isGrowthPlus) {
                            setActiveTab("members");
                          } else {
                            setShowSubscription(true);
                          }
                        }}
                        className="text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1"
                      >
                        <Users className="w-3 h-3" /> {String((cal as Record<string, unknown>).rsvpCount ?? 0)} RSVPs
                      </button>
                      <Link
                        href={`/org/${cal.shareId}`}
                        target="_blank"
                        className="text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1"
                      >
                        View Calendar <ExternalLink className="w-3 h-3" />
                      </Link>
                      <Link
                        href={`/dashboard/${cal.objectId}/plans`}
                        className="text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1"
                      >
                        Manage Plans <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Calendars tab removed — calendars now shown on Overview */}

        {/* ──────── SETTINGS TAB (Growth/Pro) ──────── */}
        {activeTab === "settings" && isGrowthPlus && (
          <div className="space-y-8">
            {/* Organization Logo */}
            <section className="border border-zinc-200 rounded-xl p-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4">Organization Logo</h2>
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-xl border border-zinc-200 overflow-hidden bg-zinc-50 flex items-center justify-center shrink-0">
                  {settingsLogoPreview || dashboard.profilePhoto ? (
                    <img
                      src={settingsLogoPreview || dashboard.profilePhoto || ""}
                      alt="Logo"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImagePlus className="w-6 h-6 text-zinc-300" />
                  )}
                </div>
                <div>
                  <label className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors cursor-pointer">
                    <ImagePlus className="w-4 h-4" />
                    {dashboard.profilePhoto || settingsLogoPreview ? "Change Logo" : "Upload Logo"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoSelect}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-zinc-400 mt-2">Square image recommended. Visible on your public calendar page.</p>
                </div>
              </div>
            </section>

            {/* Brand Color */}
            <section className="border border-zinc-200 rounded-xl p-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4">Brand Color</h2>
              <div className="flex items-center gap-4">
                <div
                  className="w-10 h-10 rounded-lg border border-zinc-200"
                  style={{ backgroundColor: settingsBrandColor }}
                />
                <input
                  type="text"
                  value={settingsBrandColor}
                  onChange={(e) => setSettingsBrandColor(e.target.value)}
                  className="border-b border-zinc-300 py-2 text-sm font-mono focus:outline-none focus:border-zinc-900 w-28"
                  placeholder="#18181b"
                />
                <div className="flex gap-2">
                  {["#18181b", "#dc2626", "#2563eb", "#059669", "#7c3aed", "#ea580c"].map((c) => (
                    <button
                      key={c}
                      onClick={() => setSettingsBrandColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        settingsBrandColor === c ? "border-zinc-900 scale-110" : "border-zinc-200"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </section>

            {/* Days of Week */}
            <section className="border border-zinc-200 rounded-xl p-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4">Preferred Days</h2>
              <p className="text-xs text-zinc-500 mb-3">AI will generate plans on these days.</p>
              <div className="flex gap-2">
                {DAY_NAMES.map((day, i) => {
                  const active = settingsDaysOfWeek.includes(i);
                  return (
                    <button
                      key={day}
                      onClick={() => {
                        setSettingsDaysOfWeek((prev) =>
                          active ? prev.filter((d) => d !== i) : [...prev, i]
                        );
                      }}
                      className={`w-12 h-10 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
                        active
                          ? "bg-zinc-900 text-white"
                          : "border border-zinc-200 text-zinc-400 hover:border-zinc-300"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Save */}
            <button
              onClick={handleSaveSettings}
              disabled={settingsSaving}
              className="bg-zinc-900 text-white px-6 py-3 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              {settingsSaving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        )}

        {/* ──────── MEMBERS & RSVPs TAB (Growth/Pro) ──────── */}
        {activeTab === "members" && isGrowthPlus && (
          <div className="space-y-8">
            {/* Invite Co-Host */}
            <section className="border border-zinc-200 rounded-xl p-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4">
                Invite Co-Host
              </h2>
              <p className="text-xs text-zinc-500 mb-4">
                Co-hosts can create plans, view RSVPs, and help manage the calendar.
              </p>
              {inviteSuccess && (
                <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-3 rounded-lg mb-4 text-sm">
                  <Check className="w-4 h-4" /> {inviteSuccess}
                </div>
              )}
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Email</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full border-b border-zinc-300 py-2 text-sm font-light focus:outline-none focus:border-zinc-900"
                    placeholder="cohost@example.com"
                  />
                </div>
                <div className="w-40">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Name (optional)</label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="w-full border-b border-zinc-300 py-2 text-sm font-light focus:outline-none focus:border-zinc-900"
                    placeholder="Name"
                  />
                </div>
                <button
                  onClick={handleInviteCoHost}
                  disabled={!inviteEmail || inviting}
                  className="bg-zinc-900 text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors disabled:opacity-50 shrink-0"
                >
                  {inviting ? "Sending..." : "Send Invite"}
                </button>
              </div>
            </section>

            {/* Members */}
            <section>
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4">
                Members ({dashboard.members.length})
              </h2>
              {dashboard.members.length === 0 ? (
                <p className="text-sm text-zinc-400">No members yet.</p>
              ) : (
                <div className="border border-zinc-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-xs uppercase tracking-widest text-zinc-400">
                      <tr>
                        <th className="text-left px-4 py-3 font-bold">Name</th>
                        <th className="text-left px-4 py-3 font-bold">Email</th>
                        <th className="text-left px-4 py-3 font-bold">Role</th>
                        <th className="text-left px-4 py-3 font-bold">Joined</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {dashboard.members.map((m, i) => (
                        <tr key={m.objectId || i}>
                          <td className="px-4 py-3">{m.name}</td>
                          <td className="px-4 py-3 text-zinc-400">{m.email || "—"}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs bg-zinc-100 px-2 py-0.5 rounded-full">
                              {m.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-400">
                            {new Date(m.joinedAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* RSVPs */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
                  RSVPs ({dashboard.rsvps.length})
                </h2>
                {dashboard.rsvps.length > 0 && (
                  <button
                    onClick={exportRsvpsCsv}
                    className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Export CSV
                  </button>
                )}
              </div>
              {dashboard.rsvps.length === 0 ? (
                <p className="text-sm text-zinc-400">No RSVPs yet.</p>
              ) : (
                <div className="border border-zinc-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-xs uppercase tracking-widest text-zinc-400">
                      <tr>
                        <th className="text-left px-4 py-3 font-bold">Name</th>
                        <th className="text-left px-4 py-3 font-bold">Phone</th>
                        <th className="text-left px-4 py-3 font-bold">Plan</th>
                        <th className="text-left px-4 py-3 font-bold">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {dashboard.rsvps.map((r) => (
                        <tr key={r.objectId}>
                          <td className="px-4 py-3">{r.name}</td>
                          <td className="px-4 py-3 text-zinc-400">{r.phone || "—"}</td>
                          <td className="px-4 py-3">{r.planTitle}</td>
                          <td className="px-4 py-3 text-zinc-400">
                            {new Date(r.date).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ──────── SUBSCRIPTION TAB ──────── */}
        {activeTab === "subscription" && (
          <div className="space-y-8">
            <section className="border border-zinc-200 rounded-xl p-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-2">Current Plan</h2>
              <p className="text-2xl font-light mb-1">{tierLabel}</p>
              <p className="text-xs text-zinc-500">
                {dashboard.tier === "starter"
                  ? "Free — basic features"
                  : dashboard.tier === "growth"
                  ? "$29/month — enhanced features"
                  : "$99/month — full features"}
              </p>
            </section>

            <button
              onClick={() => setShowSubscription(true)}
              className="bg-zinc-900 text-white px-6 py-3 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors"
            >
              {dashboard.tier === "starter" ? "Upgrade Plan" : "Change Plan"}
            </button>

            {dashboard.tier !== "starter" && (
              <button
                onClick={handleCancelSubscription}
                disabled={subscriptionLoading}
                className="block text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
              >
                Cancel Subscription
              </button>
            )}
          </div>
        )}
      </main>

      {/* ──────── MODALS ──────── */}

      {/* Add Calendar Modal */}
      {showAddCalendar && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-xl p-8 relative">
            <button
              onClick={() => setShowAddCalendar(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-zinc-100"
            >
              <Plus className="w-5 h-5 rotate-45" />
            </button>
            <h2 className="text-xl font-light tracking-tight mb-6">Add Calendar</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Name</label>
                <input
                  value={newCalName}
                  onChange={(e) => setNewCalName(e.target.value)}
                  className="w-full border-b border-zinc-300 py-2 text-lg font-light focus:outline-none focus:border-zinc-900"
                  placeholder="Calendar name"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Description</label>
                <textarea
                  value={newCalDesc}
                  onChange={(e) => setNewCalDesc(e.target.value)}
                  rows={2}
                  className="w-full border border-zinc-200 rounded-lg p-3 text-sm font-light focus:outline-none focus:border-zinc-400 resize-none"
                  placeholder="What is this calendar about?"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">City</label>
                <CityAutocomplete
                  value={newCalCity}
                  onChange={(v) => { setNewCalCity(v); setNewCalCitySelected(false); }}
                  onSelect={(place) => { setNewCalCity(place.description); setNewCalCitySelected(true); }}
                  className="w-full border-b border-zinc-300 py-2 text-lg font-light focus:outline-none focus:border-zinc-900"
                />
              </div>
              <button
                onClick={handleAddCalendar}
                disabled={!newCalName || !newCalCitySelected || addingCalendar}
                className="w-full bg-zinc-900 text-white py-3 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors disabled:opacity-50 mt-2"
              >
                {addingCalendar ? "Creating..." : "Create Calendar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Modal */}
      {showSubscription && (
        <SubscriptionModal
          currentTier={dashboard.tier}
          onSelect={handleSubscriptionChange}
          onClose={() => setShowSubscription(false)}
          loading={subscriptionLoading}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-t-2xl md:rounded-xl p-8 text-center">
            <Trash2 className="w-10 h-10 mx-auto mb-4 text-red-400" />
            <h2 className="text-xl font-light tracking-tight mb-2">Delete Organization?</h2>
            <p className="text-sm text-zinc-500 mb-6">
              This will permanently delete <strong>{dashboard.name}</strong> and all its calendars, plans, and data. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 border border-zinc-200 py-3 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-600 text-white py-3 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white px-5 py-3 rounded-lg shadow-lg text-sm flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4" />
          {toast}
        </div>
      )}
    </div>
  );
}
