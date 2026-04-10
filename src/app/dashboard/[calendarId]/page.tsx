"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  Clock,
  Download,
  Heart,
  ImagePlus,
  Layers,
  Link2,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  Users,
  UserMinus,
  Lock,
  CreditCard,
  ExternalLink,
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
  imageStyle: string;
  memberCount: number;
  totalRsvpCount: number;
  rsvpLimit: number | null;
  planIdeaCount: number;
  upcomingPlanCount: number;
  followerCount: number;
  members: {
    membershipId: string;
    objectId: string | null;
    name: string;
    email: string | null;
    status: string;
    joinedAt: string;
  }[];
  followers: {
    membershipId: string;
    objectId: string | null;
    name: string;
    phone: string | null;
    calendarId: string | null;
    calendarName: string | null;
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
    description: string;
    shareId: string;
    city: string;
    isPrimary: boolean;
    isActive: boolean;
  }[];
  calendarLimit: number | null;
  hostRequests: {
    planId: string;
    title: string;
    image: string | null;
    calendarName: string | null;
    calendarId: string | null;
    requesterName: string;
    requesterPhone: string | null;
    requestedDate: string | null;
    requestedNote: string | null;
    requestedVenue: { name: string; address: string } | null;
    requestedAt: string | null;
  }[];
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TABS = [
  { id: "overview", label: "Overview", icon: Calendar },
  { id: "calendars", label: "Calendars", icon: Layers },
  { id: "followers", label: "Followers", icon: Heart },
  { id: "members", label: "Users", icon: Users },
  { id: "subscription", label: "Subscription", icon: CreditCard },
  { id: "settings", label: "Settings", icon: Settings },
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
  const [settingsImageStyle, setSettingsImageStyle] = useState("default");
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

  // Edit calendar
  const [editingCalId, setEditingCalId] = useState<string | null>(null);
  const [editCalName, setEditCalName] = useState("");
  const [editCalDesc, setEditCalDesc] = useState("");
  const [editCalSlug, setEditCalSlug] = useState("");
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const [savingCal, setSavingCal] = useState(false);
  const slugTimerRef = useRef<NodeJS.Timeout | null>(null);
  const originalSlugRef = useRef<string>("");

  function handleSlugChange(raw: string) {
    const cleaned = raw.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 40);
    setEditCalSlug(cleaned);
    setSlugAvailable(null);
    if (slugTimerRef.current) clearTimeout(slugTimerRef.current);
    if (cleaned === originalSlugRef.current) {
      setSlugAvailable(null);
      return;
    }
    if (cleaned.length < 3) {
      setSlugAvailable(false);
      return;
    }
    setSlugChecking(true);
    slugTimerRef.current = setTimeout(async () => {
      try {
        const result = await Parse.Cloud.run("checkSlugAvailable", { slug: cleaned, excludeCalendarId: editingCalId });
        setSlugAvailable(result.available);
      } catch {
        setSlugAvailable(null);
      } finally {
        setSlugChecking(false);
      }
    }, 400);
  }

  // Plan detail modal
  const [selectedActivePlan, setSelectedActivePlan] = useState<{ objectId: string; title: string; description: string; image: string | null; date: string; time: string | null; hostName: string; rsvpCount: number; location: { name: string; address: string } | null } | null>(null);

  // Co-host invite
  const [followerCalFilter, setFollowerCalFilter] = useState<string>("all");
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
      setSettingsImageStyle(result.imageStyle || "default");
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

  async function handleSaveCalendar() {
    if (!editingCalId) return;
    setSavingCal(true);
    try {
      const params: Record<string, string> = {
        calendarId: editingCalId,
        name: editCalName,
        description: editCalDesc,
      };
      if (editCalSlug !== originalSlugRef.current) {
        params.slug = editCalSlug;
      }
      const result = await Parse.Cloud.run("updateCalendar", params);
      const newShareId = result.shareId;
      setDashboard((d) => d ? {
        ...d,
        calendars: d.calendars.map((c) =>
          c.objectId === editingCalId ? { ...c, name: editCalName, description: editCalDesc, shareId: newShareId } : c
        ),
      } : d);
      setEditingCalId(null);
    } catch (err: unknown) {
      console.error("Failed to update calendar:", err);
      const msg = err instanceof Error ? err.message : "Failed to update calendar.";
      alert(msg);
    } finally {
      setSavingCal(false);
    }
  }

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
        imageStyle: settingsImageStyle,
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
          imageStyle: settingsImageStyle,
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
            <p className="text-xs text-zinc-400">{tierLabel} Plan</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-6">
          <nav className="flex gap-1 -mb-px overflow-x-auto no-scrollbar">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? "border-zinc-900 text-zinc-900"
                      : "border-transparent text-zinc-400 hover:text-zinc-600"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
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
            {/* Pending Host Requests */}
            {dashboard.hostRequests && dashboard.hostRequests.length > 0 && (
              <section className="border border-amber-200 bg-amber-50/50 rounded-xl p-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-amber-600 mb-4">
                  Pending Host Requests ({dashboard.hostRequests.length})
                </h2>
                <div className="space-y-4">
                  {dashboard.hostRequests.map((req) => (
                    <div key={req.planId} className="flex items-start gap-4 bg-white border border-zinc-200 rounded-lg p-4">
                      {req.image && (
                        <img src={req.image} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-900 truncate">{req.title}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          <strong>{req.requesterName}</strong>
                          {req.requesterPhone && <> &middot; {req.requesterPhone}</>}
                          {req.calendarName && <> &middot; {req.calendarName}</>}
                        </p>
                        {req.requestedDate && (
                          <p className="text-xs text-zinc-400 mt-0.5">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {new Date(req.requestedDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </p>
                        )}
                        {req.requestedNote && (
                          <p className="text-xs text-zinc-400 italic mt-1 truncate">&ldquo;{req.requestedNote}&rdquo;</p>
                        )}
                        {req.requestedVenue && (
                          <p className="text-xs text-zinc-400 mt-0.5">{req.requestedVenue.name}</p>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={async () => {
                            try {
                              await Parse.Cloud.run("approveHostRequest", { calendarPlanId: req.planId });
                              setDashboard((d) => d ? { ...d, hostRequests: d.hostRequests.filter((r) => r.planId !== req.planId) } : d);
                            } catch (err) {
                              console.error("Failed to approve:", err);
                            }
                          }}
                          className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await Parse.Cloud.run("declineHostRequest", { calendarPlanId: req.planId });
                              setDashboard((d) => d ? { ...d, hostRequests: d.hostRequests.filter((r) => r.planId !== req.planId) } : d);
                            } catch (err) {
                              console.error("Failed to decline:", err);
                            }
                          }}
                          className="px-3 py-1.5 bg-white text-zinc-600 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-zinc-300 hover:bg-zinc-50 transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

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
                { label: "Followers", value: dashboard.followerCount },
                { label: "Calendars", value: dashboard.calendars.length },
                { label: "Plan RSVPs", value: `${dashboard.totalRsvpCount}${dashboard.rsvpLimit ? `/${dashboard.rsvpLimit}` : ""}` },
                { label: "Active Plans", value: dashboard.upcomingPlanCount },
              ].map((stat) => (
                <div key={stat.label} className="border border-zinc-200 rounded-xl p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">{stat.label}</p>
                  <p className="text-2xl font-light">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Concierge Ad */}
            <div className="border border-emerald-200 rounded-xl p-6 bg-gradient-to-br from-emerald-50/60 to-white">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-medium text-zinc-900">Book a Strategy Session</h3>
                <span className="bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full">New</span>
              </div>
              <p className="text-sm text-zinc-500 leading-relaxed mb-4">
                Planning shouldn&apos;t feel like a second job. Meet with a Leaf consultant to iron out the details and get your community moving.
              </p>
              <ul className="space-y-2 mb-5 list-disc list-inside">
                <li className="text-xs text-zinc-500 leading-relaxed"><strong className="text-zinc-700">Tailored Plan Ideas</strong> — Personalized suggestions for your specific community type, from gyms to creative clubs.</li>
                <li className="text-xs text-zinc-500 leading-relaxed"><strong className="text-zinc-700">Direct Venue Sourcing</strong> — Access our network of preferred venues and unique spaces to host your next gathering.</li>
                <li className="text-xs text-zinc-500 leading-relaxed"><strong className="text-zinc-700">Logistical Audit</strong> — We&apos;ll review your upcoming schedule to ensure every plan has the right timing and &ldquo;vibe&rdquo; to succeed.</li>
              </ul>
              <a href="https://calendly.com/shawn-58c/leaf-info-call" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-zinc-900 text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors">
                Schedule Your Session
              </a>
            </div>

          </div>
        )}

        {/* ──────── CALENDARS TAB ──────── */}
        {activeTab === "calendars" && (
          <div className="space-y-4">
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
              {dashboard.calendars.map((cal) => {
                const activePlans = ((cal as Record<string, unknown>).activePlans as { objectId: string; title: string; description: string; image: string | null; date: string; time: string | null; hostName: string; rsvpCount: number; location: { name: string; address: string } | null }[]) || [];
                const inactive = cal.isActive === false;
                return (
                  <div
                    key={cal.objectId}
                    className={`border rounded-xl p-5 ${inactive ? "border-zinc-100 bg-zinc-50 opacity-60" : "border-zinc-200"}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-medium ${inactive ? "text-zinc-400" : ""}`}>{cal.name}</h3>
                          {!inactive && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const url = `${window.location.origin}/org/${cal.shareId}`;
                                navigator.clipboard.writeText(url);
                                setToast("Link copied!");
                                setTimeout(() => setToast(null), 2000);
                              }}
                              className="text-zinc-300 hover:text-zinc-600 transition-colors"
                              title="Copy calendar link"
                            >
                              <Link2 className="w-4 h-4" />
                            </button>
                          )}
                          {cal.isPrimary && (
                            <span className="text-[10px] font-bold uppercase tracking-widest bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full">
                              Primary
                            </span>
                          )}
                          {inactive && (
                            <span className="text-[10px] font-bold uppercase tracking-widest bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400">{cal.city || "No city set"}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        {inactive ? (
                          <button
                            onClick={() => setShowSubscription(true)}
                            className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors"
                          >
                            <Lock className="w-3.5 h-3.5" /> Upgrade to Reactivate
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => { setEditingCalId(cal.objectId); setEditCalName(cal.name); setEditCalDesc(cal.description || ""); setEditCalSlug(cal.shareId || ""); originalSlugRef.current = cal.shareId || ""; setSlugAvailable(null); }}
                              className="text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1"
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                            <Link
                              href={`/dashboard/${cal.objectId}/plans`}
                              className="text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1"
                            >
                              Manage Plans <ChevronRight className="w-3 h-3" />
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                    {!inactive && activePlans.length > 0 && (
                      <div className="border-t border-zinc-100 pt-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3">Active Plans</p>
                        <div className="flex gap-3 overflow-x-auto no-scrollbar">
                          {activePlans.map((plan) => (
                            <div key={plan.objectId} onClick={() => setSelectedActivePlan(plan)} className="border border-zinc-100 rounded-lg overflow-hidden hover:border-zinc-200 transition-colors shrink-0 w-52 cursor-pointer">
                              {plan.image ? (
                                <img src={plan.image} alt={plan.title} className="w-full h-28 object-cover" />
                              ) : (
                                <div className="w-full h-28 bg-zinc-100 flex items-center justify-center">
                                  <Calendar className="w-6 h-6 text-zinc-300" />
                                </div>
                              )}
                              <div className="p-3">
                                <h4 className="font-medium text-sm mb-1 truncate">{plan.title}</h4>
                                <p className="text-xs text-zinc-400 mb-1">{new Date(plan.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
                                <div className="flex items-center justify-between text-xs text-zinc-400">
                                  <span className="truncate">{plan.hostName}</span>
                                  <span className="shrink-0 ml-2">{plan.rsvpCount} RSVPs</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ──────── SETTINGS TAB ──────── */}
        {activeTab === "settings" && (
          <div className="space-y-8">
            {/* Organization Logo (Growth/Pro) */}
            <div className="relative">
              {!isGrowthPlus && (
                <div className="absolute top-4 right-4 z-10" onClick={() => setShowSubscription(true)}>
                  <div className="flex items-center gap-2 bg-zinc-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:bg-zinc-800 transition-colors">
                    <Lock className="w-3 h-3" /> Upgrade
                  </div>
                </div>
              )}
            <section className={`border border-zinc-200 rounded-xl p-6 ${!isGrowthPlus ? "opacity-40 pointer-events-none" : ""}`}>
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
            </div>

            {/* Brand Color (Growth/Pro) */}
            <div className="relative">
              {!isGrowthPlus && (
                <div className="absolute top-4 right-4 z-10" onClick={() => setShowSubscription(true)}>
                  <div className="flex items-center gap-2 bg-zinc-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:bg-zinc-800 transition-colors">
                    <Lock className="w-3 h-3" /> Upgrade
                  </div>
                </div>
              )}
            <section className={`border border-zinc-200 rounded-xl p-6 ${!isGrowthPlus ? "opacity-40 pointer-events-none" : ""}`}>
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
            </div>

            {/* Photo Style */}
            <section className="border border-zinc-200 rounded-xl p-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4">Photo Style</h2>
              <p className="text-xs text-zinc-500 mb-3">Control what kind of images AI selects for plan ideas.</p>
              <div className="flex gap-2">
                {([
                  { id: "default", label: "Default" },
                  { id: "no-people", label: "No People" },
                  { id: "venue-focused", label: "Venue & Activity" },
                ] as const).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setSettingsImageStyle(opt.id)}
                    className={`px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
                      settingsImageStyle === opt.id
                        ? "bg-zinc-900 text-white"
                        : "border border-zinc-200 text-zinc-400 hover:border-zinc-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
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
        {activeTab === "members" && (
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

            {/* Users */}
            <section>
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4">
                Users ({dashboard.members.length})
              </h2>
              {dashboard.members.length === 0 ? (
                <p className="text-sm text-zinc-400">No users yet.</p>
              ) : (
                <div className="border border-zinc-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-xs uppercase tracking-widest text-zinc-400">
                      <tr>
                        <th className="text-left px-4 py-3 font-bold">Name</th>
                        <th className="text-left px-4 py-3 font-bold">Email</th>
                        <th className="text-left px-4 py-3 font-bold">Role</th>
                        <th className="text-left px-4 py-3 font-bold">Joined</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {dashboard.members.map((m, i) => (
                        <tr key={m.membershipId || i}>
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
                          <td className="px-4 py-3 text-right">
                            {m.status !== "Owned" && (
                              <button
                                onClick={async () => {
                                  if (!confirm(`Remove ${m.name} from this calendar?`)) return;
                                  try {
                                    await Parse.Cloud.run("removeMember", { membershipId: m.membershipId, calendarId });
                                    setDashboard((d) => d ? { ...d, members: d.members.filter((x) => x.membershipId !== m.membershipId) } : d);
                                  } catch (err) {
                                    console.error("Failed to remove member:", err);
                                  }
                                }}
                                className="text-zinc-400 hover:text-red-500 transition-colors"
                                title="Remove user"
                              >
                                <UserMinus className="w-4 h-4" />
                              </button>
                            )}
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

        {/* ──────── FOLLOWERS TAB (Growth/Pro) ──────── */}
        {activeTab === "followers" && (
          <div className="space-y-8">
            <section>
              {(() => {
                const filteredFollowers = followerCalFilter === "all"
                  ? dashboard.followers
                  : dashboard.followers.filter((f) => f.calendarId === followerCalFilter);
                const calendarNames = [...new Map(dashboard.followers.filter((f) => f.calendarId).map((f) => [f.calendarId, f.calendarName])).entries()];
                return (<>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
                  Followers ({filteredFollowers.length})
                </h2>
                {dashboard.calendars.length > 1 && (
                  <select
                    value={followerCalFilter}
                    onChange={(e) => setFollowerCalFilter(e.target.value)}
                    className="text-xs border border-zinc-200 rounded-lg px-3 py-2 text-zinc-600 focus:outline-none focus:border-zinc-400"
                  >
                    <option value="all">All Calendars</option>
                    {dashboard.calendars.filter((c) => c.isActive).map((cal) => (
                      <option key={cal.objectId} value={cal.objectId}>{cal.name}</option>
                    ))}
                  </select>
                )}
              </div>
              {filteredFollowers.length === 0 ? (
                <div className="border border-zinc-200 rounded-xl p-8 space-y-6">
                  <div className="text-center">
                    <h3 className="text-lg font-light text-zinc-900 mb-2">Share your calendar to get followers</h3>
                    <p className="text-sm text-zinc-400">When people follow your calendar, they&apos;ll see your plans and get notified about upcoming events.</p>
                  </div>
                  <div className="space-y-3">
                    {dashboard.calendars.filter((c) => c.isActive).map((cal) => (
                      <div key={cal.objectId} className="bg-zinc-50 rounded-lg p-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-0.5">{cal.name}</p>
                          <p className="text-sm font-mono text-zinc-900">os.joinleaf.com/org/{cal.shareId}</p>
                        </div>
                        <div className="flex gap-2">
                          <a
                            href={`/org/${cal.shareId}`}
                            target="_blank"
                            className="bg-zinc-900 text-white px-4 py-2 text-[10px] uppercase tracking-[0.2em] font-bold rounded-lg hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </a>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`os.joinleaf.com/org/${cal.shareId}`);
                              setToast("Link copied!");
                              setTimeout(() => setToast(null), 2000);
                            }}
                            className="border border-zinc-200 px-4 py-2 text-[10px] uppercase tracking-[0.2em] font-bold rounded-lg hover:bg-white transition-colors flex items-center gap-1.5"
                          >
                            <Link2 className="w-3 h-3" /> Copy
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="border border-zinc-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-xs uppercase tracking-widest text-zinc-400">
                      <tr>
                        <th className="text-left px-4 py-3 font-bold">Name</th>
                        {dashboard.calendars.length > 1 && followerCalFilter === "all" && (
                          <th className="text-left px-4 py-3 font-bold">Calendar</th>
                        )}
                        <th className="text-left px-4 py-3 font-bold">Phone</th>
                        <th className="text-left px-4 py-3 font-bold">Joined</th>
                        <th className="text-right px-4 py-3 font-bold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {filteredFollowers.map((f) => (
                        <tr key={f.membershipId}>
                          <td className="px-4 py-3">{f.name}</td>
                          {dashboard.calendars.length > 1 && followerCalFilter === "all" && (
                            <td className="px-4 py-3 text-zinc-400">{f.calendarName || "—"}</td>
                          )}
                          <td className="px-4 py-3 text-zinc-400">{f.phone || "—"}</td>
                          <td className="px-4 py-3 text-zinc-400">
                            {new Date(f.joinedAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={async () => {
                                if (!confirm(`Remove ${f.name} as a follower?`)) return;
                                try {
                                  await Parse.Cloud.run("removeFollower", {
                                    membershipId: f.membershipId,
                                    calendarId,
                                  });
                                  setDashboard((d) =>
                                    d ? { ...d, followers: d.followers.filter((x) => x.membershipId !== f.membershipId), followerCount: d.followerCount - 1 } : d
                                  );
                                } catch (err) {
                                  console.error("Failed to remove follower:", err);
                                }
                              }}
                              className="text-zinc-300 hover:text-red-500 transition-colors"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
                </>);
              })()}
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
      {/* Edit Calendar Modal */}
      {editingCalId && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-xl p-8 relative">
            <button
              onClick={() => setEditingCalId(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-zinc-100"
            >
              <Plus className="w-5 h-5 rotate-45" />
            </button>
            <h2 className="text-xl font-light tracking-tight mb-6">Edit Calendar</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Name</label>
                <input
                  value={editCalName}
                  onChange={(e) => setEditCalName(e.target.value)}
                  className="w-full border-b border-zinc-300 py-2 text-lg font-light focus:outline-none focus:border-zinc-900"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Description</label>
                <textarea
                  value={editCalDesc}
                  onChange={(e) => setEditCalDesc(e.target.value)}
                  rows={3}
                  className="w-full border border-zinc-200 rounded-lg p-3 text-sm font-light focus:outline-none focus:border-zinc-400 resize-none"
                  placeholder="What is this calendar about?"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">URL Slug</label>
                <div className="flex items-center gap-0">
                  <span className="text-sm text-zinc-400 font-light whitespace-nowrap">os.joinleaf.com/org/</span>
                  <input
                    value={editCalSlug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    className="flex-1 border-b border-zinc-300 py-2 text-sm font-light focus:outline-none focus:border-zinc-900 ml-1"
                    placeholder="my-calendar"
                  />
                </div>
                {editCalSlug && editCalSlug !== originalSlugRef.current && (
                  <p className={`text-xs mt-1 ${slugChecking ? "text-zinc-400" : slugAvailable === true ? "text-green-600" : slugAvailable === false ? "text-red-500" : "text-zinc-400"}`}>
                    {slugChecking ? "Checking..." : slugAvailable === true ? "Available!" : slugAvailable === false ? (editCalSlug.length < 3 ? "Must be at least 3 characters" : "Already taken") : ""}
                  </p>
                )}
              </div>
              <button
                onClick={handleSaveCalendar}
                disabled={!editCalName || savingCal || (editCalSlug !== originalSlugRef.current && (slugAvailable === false || slugChecking))}
                className="w-full bg-zinc-900 text-white py-3 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors disabled:opacity-50 mt-2"
              >
                {savingCal ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Plan Detail Modal */}
      {selectedActivePlan && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-5xl md:h-[85vh] overflow-hidden flex flex-col md:flex-row shadow-2xl rounded-t-3xl md:rounded-none relative">
            <button
              onClick={() => setSelectedActivePlan(null)}
              className="absolute top-6 right-6 z-50 p-2 rounded-full bg-white/20 text-white md:text-zinc-900 md:bg-transparent"
            >
              <Plus className="w-8 h-8 rotate-45" />
            </button>

            <div className="hidden md:block w-1/2 h-full bg-zinc-100">
              {selectedActivePlan.image ? (
                <img src={selectedActivePlan.image} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Calendar className="w-20 h-20 text-zinc-300" />
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-8 md:p-16 space-y-12">
              <div className="space-y-4">
                <h2 className="text-4xl md:text-5xl font-light tracking-tighter">
                  {selectedActivePlan.title}
                </h2>
                <p className="text-sm font-bold uppercase tracking-widest text-zinc-900">
                  Hosted by {selectedActivePlan.hostName}
                </p>
                <div className="flex gap-6 text-sm text-zinc-500 font-light border-y border-zinc-100 py-6">
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {new Date(selectedActivePlan.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                    {selectedActivePlan.time && ` at ${selectedActivePlan.time}`}
                  </span>
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4" /> {selectedActivePlan.rsvpCount} attending
                  </span>
                </div>
              </div>

              {(selectedActivePlan.description || selectedActivePlan.location) && (
                <div className="space-y-6">
                  {selectedActivePlan.description && (
                    <p className="text-xl font-light leading-relaxed text-zinc-600">
                      {selectedActivePlan.description}
                    </p>
                  )}
                  {selectedActivePlan.location && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] tracking-[0.3em] uppercase font-bold text-zinc-400">
                        Location
                      </h4>
                      <p className="text-sm text-zinc-700">{selectedActivePlan.location.name}</p>
                      <p className="text-sm text-zinc-500">{selectedActivePlan.location.address}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-8 border-t border-zinc-100">
                <button
                  onClick={async () => {
                    if (!confirm("Delete this plan? This cannot be undone.")) return;
                    try {
                      await Parse.Cloud.run("removePlanFromCalendar", { eventGroupId: selectedActivePlan.objectId });
                      setSelectedActivePlan(null);
                      fetchDashboard();
                    } catch (err) {
                      console.error("Failed to delete plan:", err);
                      alert("Failed to delete plan.");
                    }
                  }}
                  className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-500 hover:text-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Plan
                </button>
              </div>
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
