"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import CityAutocomplete from "@/components/CityAutocomplete";
import SubscriptionModal from "@/components/SubscriptionModal";
import MarketplaceTab, { type MarketplaceEvent, type OrgSettings } from "@/components/MarketplaceTab";
import CreatePlanModal, { type CreatePlanPrefill } from "@/components/CreatePlanModal";
import PhoneVerificationModal from "@/components/PhoneVerificationModal";
import {
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Copy,
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
  ExternalLink,
  LogOut,
  TrendingUp,
  Sparkles,
  Code,
  Ticket,
  Phone,
  Smartphone,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────

interface OrgDashboard {
  objectId: string;
  name: string;
  description: string;
  shareId: string;
  orgType: string | null;
  tier: string;
  isOwner: boolean;
  profilePhoto: string | null;
  bannerUrl: string | null;
  brandColor: string;
  daysOfWeek: number[];
  preferredTimes: string[];
  blacklistCategories: string[];
  excludeKeywords: string[];
  locationTypes: string[];
  cities: string[];
  planIdeasPerWeek: number;
  website: string;
  imageStyle: string;
  hidePlanIdeas: boolean;
  hideCustomPlans: boolean;
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
    leafAppConnected?: boolean;
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
    eventGroupId: string | null;
    name: string;
    phone: string | null;
    planTitle: string;
    date: string;
    source: string;
  }[];
  pendingFollowerCount: number;
  pendingFollowers: {
    membershipId: string;
    objectId: string | null;
    name: string;
    phone: string | null;
    calendarId: string | null;
    calendarName: string | null;
    requestedAt: string;
  }[];
  calendars: {
    objectId: string;
    name: string;
    description: string;
    shareId: string;
    city: string;
    isPrimary: boolean;
    isActive: boolean;
    calendarImage: string | null;
    hideVenueUntilRsvp: boolean;
    isPrivate: boolean;
    hidePlanIdeas: boolean;
    hideCustomPlans: boolean;
    pendingFollowerCount: number;
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
  pendingRsvpRequests: {
    notificationId: string;
    eventGroupId: string | null;
    name: string;
    phone: string | null;
    planTitle: string;
    planImage: string | null;
    rsvpNote: string | null;
    requestedAt: string;
  }[];
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TIME_OF_DAY_OPTIONS: { id: string; label: string; hint: string }[] = [
  { id: "morning", label: "Morning", hint: "6a – 12p" },
  { id: "afternoon", label: "Afternoon", hint: "12p – 5p" },
  { id: "evening", label: "Evening", hint: "5p – 9p" },
  { id: "night", label: "Night", hint: "9p – late" },
];

const BLACKLIST_PRESETS: string[] = [
  "Bars",
  "Nightclubs",
  "Casinos",
  "Adult venues",
  "Smoking lounges",
  "Religious venues",
  "Late-night venues",
  "Fast food",
];

const TABS = [
  { id: "overview", label: "Overview", icon: Calendar },
  { id: "calendars", label: "Calendars", icon: Layers },
  { id: "followers", label: "Followers", icon: Heart },
  { id: "members", label: "Users", icon: Users, ownerOnly: true },
  { id: "analytics", label: "Analytics", icon: TrendingUp, proOnly: true },
  { id: "marketplace", label: "Marketplace", icon: Ticket, growthOnly: true },
  { id: "settings", label: "Settings", icon: Settings, ownerOnly: true },
];

// ── Analytics types ────────────────────────────────────────────────────

interface AnalyticsSeriesPoint {
  date: string;
  value: number;
}

interface OrgAnalytics {
  range: string;
  generatedAt: string;
  growth: {
    followerCount: number;
    followersInRange: number;
    followerDeltaPct: number;
    memberCount: number;
    membersInRange: number;
    rsvpsInRange: number;
    rsvpDeltaPct: number;
    followerSeries: AnalyticsSeriesPoint[];
    rsvpSeries: AnalyticsSeriesPoint[];
  };
  engagement: {
    rsvpCount: number;
    planCount: number;
    rsvpRate: number;
    repeatAttendeeCount: number;
    uniqueRsvpUsersInRange: number;
    repeatRate: number;
    topPlans: { id: string; title: string; category: string; rsvpCount: number }[];
  };
  whatsWorking: {
    weekdayDistribution: { day: string; value: number }[];
    timeOfDayDistribution: { bucket: string; value: number }[];
    topCategories: { category: string; plans: number; rsvps: number }[];
  };
  insights: {
    type: string;
    message: string;
    actionLabel?: string;
    actionDayIndex?: number;
    actionTimeBucket?: string;
  }[];
}

// ── Component ──────────────────────────────────────────────────────────

export default function OrgDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const calendarId = params.calendarId as string;
  const initialTab = searchParams.get("tab") || "overview";

  const [user, setUser] = useState<Parse.User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [dashboard, setDashboard] = useState<OrgDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(initialTab);

  // Edit states
  const [editName, setEditName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [descValue, setDescValue] = useState("");
  const [saving, setSaving] = useState(false);

  // Settings states
  const [settingsDaysOfWeek, setSettingsDaysOfWeek] = useState<number[]>([]);
  const [settingsPreferredTimes, setSettingsPreferredTimes] = useState<string[]>([]);
  const [settingsBlacklistCategories, setSettingsBlacklistCategories] = useState<string[]>([]);
  const [settingsExcludeKeywords, setSettingsExcludeKeywords] = useState<string[]>([]);
  const [excludeKeywordInput, setExcludeKeywordInput] = useState("");
  const [settingsBrandColor, setSettingsBrandColor] = useState("#18181b");
  const [settingsLogoPreview, setSettingsLogoPreview] = useState<string | null>(null);
  const [settingsLogoBase64, setSettingsLogoBase64] = useState<string | null>(null);
  const [settingsImageStyle, setSettingsImageStyle] = useState("default");
  const [settingsHidePlanIdeas, setSettingsHidePlanIdeas] = useState(false);
  const [settingsHideCustomPlans, setSettingsHideCustomPlans] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSection, setSettingsSection] = useState<"general" | "subscription">("general");

  // Migration
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{ fixed: number; skipped: number; total: number } | null>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const [embedCalId, setEmbedCalId] = useState<string | null>(null);

  // Analytics
  const [analytics, setAnalytics] = useState<OrgAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsRange, setAnalyticsRange] = useState<"7d" | "30d" | "90d" | "all">("30d");

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
  const [editCalCity, setEditCalCity] = useState("");
  const [editCalCitySelected, setEditCalCitySelected] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const [savingCal, setSavingCal] = useState(false);
  const [editCalImagePreview, setEditCalImagePreview] = useState<string | null>(null);
  const [editCalImageBase64, setEditCalImageBase64] = useState<string | null>(null);
  const [editCalRemoveImage, setEditCalRemoveImage] = useState(false);
  const [editCalHideVenue, setEditCalHideVenue] = useState(true);
  const [editCalIsPrivate, setEditCalIsPrivate] = useState(false);
  const [editCalHidePlanIdeas, setEditCalHidePlanIdeas] = useState(false);
  const [editCalHideCustomPlans, setEditCalHideCustomPlans] = useState(false);
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
  const [planRsvps, setPlanRsvps] = useState<{ notificationId: string; name: string; phone: string | null; source: string; status: string; rsvpNote: string | null }[]>([]);
  const [planRsvpsLoading, setPlanRsvpsLoading] = useState(false);

  // Fetch RSVPs when plan detail modal opens
  useEffect(() => {
    if (!selectedActivePlan) { setPlanRsvps([]); return; }
    setPlanRsvpsLoading(true);
    Parse.Cloud.run("getPlanRsvps", { eventGroupId: selectedActivePlan.objectId })
      .then((result: { notificationId: string; name: string; phone: string | null; source: string; status: string; rsvpNote: string | null }[]) => setPlanRsvps(result || []))
      .catch(() => setPlanRsvps([]))
      .finally(() => setPlanRsvpsLoading(false));
  }, [selectedActivePlan]);

  // Create plan modal (used by marketplace + duplicate)
  const [createPlanPrefill, setCreatePlanPrefill] = useState<CreatePlanPrefill | null>(null);
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  // Leaf app connection (explicit OTP verification, not auto-populated from phone field)
  const [leafAppConnected, setLeafAppConnected] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneJustVerified, setPhoneJustVerified] = useState(false);

  // Co-host invite
  const [followerCalFilter, setFollowerCalFilter] = useState<string>(searchParams.get("filterCal") || "all");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState("");

  useEffect(() => {
    try {
      const current = Parse.User.current();
      if (current) {
        setUser(current);
        setLeafAppConnected(current.get("leafAppConnected") === true);
      }
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
      setSettingsPreferredTimes(result.preferredTimes || []);
      setSettingsBlacklistCategories(result.blacklistCategories || []);
      setSettingsExcludeKeywords(result.excludeKeywords || []);
      setSettingsBrandColor(result.brandColor);
      setSettingsImageStyle(result.imageStyle || "default");
      setSettingsHidePlanIdeas(result.hidePlanIdeas || false);
      setSettingsHideCustomPlans(result.hideCustomPlans || false);
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

  // Prefetch marketplace data as soon as dashboard is available
  const [prefetchedMarketplace, setPrefetchedMarketplace] = useState<MarketplaceEvent[] | null>(null);
  const marketplacePrefetched = useRef(false);

  useEffect(() => {
    if (!dashboard || marketplacePrefetched.current) return;
    marketplacePrefetched.current = true;

    const city = dashboard.calendars.find((c) => c.objectId === calendarId)?.city;
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    const qs = params.toString() ? `?${params.toString()}` : "";

    Promise.allSettled([
      city ? fetch(`/api/yelp${qs}`).then((r) => r.json()) : Promise.resolve({ events: [] }),
      city ? fetch(`/api/ticketmaster${qs}`).then((r) => r.json()) : Promise.resolve({ events: [] }),
      fetch("/api/tmdb").then((r) => r.json()),
      city ? fetch(`/api/scrape?city=${encodeURIComponent(city)}`).then((r) => r.json()) : Promise.resolve({ events: [] }),
    ]).then(([yelp, tm, tmdb, scrape]) => {
      const all: MarketplaceEvent[] = [];
      if (yelp.status === "fulfilled") all.push(...(yelp.value.events || []));
      if (tm.status === "fulfilled") all.push(...(tm.value.events || []));
      if (tmdb.status === "fulfilled") all.push(...(tmdb.value.events || []));
      if (scrape.status === "fulfilled") all.push(...(scrape.value.events || []));
      setPrefetchedMarketplace(all);
    });
  }, [dashboard, calendarId]);

  // Analytics fetcher — Pro tier only
  const fetchAnalytics = useCallback(
    async (range: "7d" | "30d" | "90d" | "all") => {
      if (!dashboard || dashboard.tier !== "pro") return;
      setAnalyticsLoading(true);
      setAnalyticsError(null);
      try {
        const result = await Parse.Cloud.run("getOrgAnalytics", {
          calendarId,
          range,
        });
        setAnalytics(result);
      } catch (err: unknown) {
        setAnalyticsError(
          err instanceof Error ? err.message : "Failed to load analytics"
        );
      } finally {
        setAnalyticsLoading(false);
      }
    },
    [calendarId, dashboard]
  );

  // Auto-load analytics when the tab opens or range changes
  useEffect(() => {
    if (activeTab === "analytics" && dashboard?.tier === "pro") {
      fetchAnalytics(analyticsRange);
    }
  }, [activeTab, analyticsRange, dashboard, fetchAnalytics]);

  // ── Handlers ──

  async function handleSaveCalendar() {
    if (!editingCalId) return;
    setSavingCal(true);
    try {
      const params: Record<string, string | boolean> = {
        calendarId: editingCalId,
        name: editCalName,
        description: editCalDesc,
      };
      if (editCalSlug !== originalSlugRef.current) {
        params.slug = editCalSlug;
      }
      if (editCalCitySelected && editCalCity) {
        params.city = editCalCity;
      }
      if (editCalImageBase64) {
        params.imageBase64 = editCalImageBase64;
      } else if (editCalRemoveImage) {
        params.removeImage = true;
      }
      params.hideVenueUntilRsvp = editCalHideVenue;
      params.isPrivate = editCalIsPrivate;
      params.hidePlanIdeas = editCalHidePlanIdeas;
      params.hideCustomPlans = editCalHideCustomPlans;
      const result = await Parse.Cloud.run("updateCalendar", params);
      const newShareId = result.shareId;
      const newCalImage = editCalRemoveImage ? null : (editCalImagePreview || null);
      setDashboard((d) => d ? {
        ...d,
        calendars: d.calendars.map((c) =>
          c.objectId === editingCalId ? { ...c, name: editCalName, description: editCalDesc, shareId: newShareId, city: editCalCity || c.city, calendarImage: editCalImageBase64 ? newCalImage : (editCalRemoveImage ? null : c.calendarImage), hideVenueUntilRsvp: editCalHideVenue, isPrivate: editCalIsPrivate, hidePlanIdeas: editCalHidePlanIdeas, hideCustomPlans: editCalHideCustomPlans } : c
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
        preferredTimes: settingsPreferredTimes,
        blacklistCategories: settingsBlacklistCategories,
        excludeKeywords: settingsExcludeKeywords,
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
          preferredTimes: settingsPreferredTimes,
          blacklistCategories: settingsBlacklistCategories,
          excludeKeywords: settingsExcludeKeywords,
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
      if (tier === "starter") {
        // Downgrade to free — schedule Stripe cancel-at-period-end
        if (!confirm("Switching to Starter will cancel your subscription at the end of the current billing period. Continue?")) {
          setSubscriptionLoading(false);
          return;
        }
        await Parse.Cloud.run("cancelOrgSubscription", { calendarId });
        setShowSubscription(false);
        fetchDashboard();
      } else {
        // Paid upgrade — open Stripe Checkout
        const result = await Parse.Cloud.run("createOrgSubscriptionCheckout", {
          calendarId,
          tier,
          returnUrl: `${window.location.origin}/dashboard/${calendarId}`,
        });
        if (result?.url) {
          window.location.href = result.url;
        } else {
          throw new Error("Checkout session could not be created.");
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update subscription";
      alert(message);
    } finally {
      setSubscriptionLoading(false);
    }
  }

  async function handleCancelSubscription() {
    if (!confirm("Are you sure you want to cancel your subscription? You will be downgraded to Starter (Free) at the end of your current billing period.")) return;
    setSubscriptionLoading(true);
    try {
      await Parse.Cloud.run("cancelOrgSubscription", { calendarId });
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

  async function handleLogout() {
    try {
      await Parse.User.logOut();
    } catch {
      // ignore
    }
    router.push("/dashboard");
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
  const tierLabel = dashboard.tier === "pro" ? "The Organizer" : dashboard.tier === "growth" ? "The Social" : "Starter";

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
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-zinc-400 hover:text-zinc-900 transition-colors shrink-0"
            title="Log out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Log out</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-6">
          <nav className="flex gap-1 -mb-px overflow-x-auto no-scrollbar">
            {TABS.map((tab) => {
              if (tab.ownerOnly && !dashboard.isOwner) return null;
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const isLocked =
                (tab.proOnly && dashboard.tier !== "pro") ||
                ((tab as { growthOnly?: boolean }).growthOnly && dashboard.tier === "starter");
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
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {tab.id === "followers" && dashboard.pendingFollowerCount > 0 && (
                    <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none min-w-[18px] text-center">
                      {dashboard.pendingFollowerCount}
                    </span>
                  )}
                  {isLocked && <Lock className="w-3 h-3 ml-0.5" />}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Leaf app connection banner (owners and co-hosts) */}
      {!leafAppConnected && (
        <div className="max-w-5xl mx-auto px-6 pt-4">
          <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
            <Smartphone className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-800 flex-1">
              <span className="font-medium">Connect to Leaf app</span> to manage plans, chat with attendees, and get RSVP notifications.
            </p>
            <button
              onClick={() => setShowPhoneModal(true)}
              className="text-xs font-medium text-amber-700 hover:text-amber-900 underline shrink-0"
            >
              Connect now
            </button>
          </div>
        </div>
      )}
      {phoneJustVerified && leafAppConnected && (
        <div className="max-w-5xl mx-auto px-6 pt-4">
          <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
            <Check className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-xs text-green-800 flex-1">
              <span className="font-medium">Connected to Leaf app</span>
            </p>
            <button
              onClick={() => setPhoneJustVerified(false)}
              className="text-xs text-green-600 hover:text-green-800 shrink-0"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

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

            {/* Pending Attendance Requests */}
            {dashboard.pendingRsvpRequests && dashboard.pendingRsvpRequests.length > 0 && (
              <section className="border border-amber-200 bg-amber-50/50 rounded-xl p-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-amber-600 mb-4">
                  Pending Attendance Requests ({dashboard.pendingRsvpRequests.length})
                </h2>
                <div className="space-y-4">
                  {dashboard.pendingRsvpRequests.map((req) => (
                    <div key={req.notificationId} className="flex items-start gap-4 bg-white border border-zinc-200 rounded-lg p-4">
                      {req.planImage && (
                        <img src={req.planImage} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-900 truncate">{req.planTitle}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          <strong>{req.name}</strong>
                          {req.phone && <> &middot; {req.phone}</>}
                        </p>
                        {req.rsvpNote && (
                          <p className="text-xs text-zinc-400 italic mt-1 truncate">&ldquo;{req.rsvpNote}&rdquo;</p>
                        )}
                        {req.requestedAt && (
                          <p className="text-xs text-zinc-400 mt-0.5">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {new Date(req.requestedAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={async () => {
                            try {
                              await Parse.Cloud.run("approveRsvpRequest", { notificationId: req.notificationId });
                              setDashboard((d) => d ? { ...d, pendingRsvpRequests: d.pendingRsvpRequests.filter((r) => r.notificationId !== req.notificationId) } : d);
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
                              await Parse.Cloud.run("declineRsvpRequest", { notificationId: req.notificationId });
                              setDashboard((d) => d ? { ...d, pendingRsvpRequests: d.pendingRsvpRequests.filter((r) => r.notificationId !== req.notificationId) } : d);
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

            {/* One-time migration for plans missing iOS visibility */}
            {migrationResult ? (
              <div className="border border-green-200 bg-green-50 rounded-xl p-4 text-xs text-green-700">
                Migration complete: {migrationResult.fixed} plans fixed, {migrationResult.skipped} already OK, {migrationResult.total} scanned.
              </div>
            ) : (
              <button
                onClick={async () => {
                  setMigrating(true);
                  try {
                    const r = await Parse.Cloud.run("migrateManualPlans") as { fixed: number; skipped: number; total: number };
                    setMigrationResult(r);
                  } catch (e) { console.error(e); alert("Migration failed — see console"); }
                  setMigrating(false);
                }}
                disabled={migrating}
                className="border border-amber-200 bg-amber-50 rounded-xl p-4 text-xs text-amber-700 hover:bg-amber-100 transition-colors w-full text-left"
              >
                {migrating ? "Migrating plans..." : "⚠️ Migrate existing plans for iOS visibility (one-time)"}
              </button>
            )}

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

        {/* ──────── ANALYTICS TAB ──────── */}
        {activeTab === "analytics" && dashboard.tier === "pro" && (
          <div className="space-y-8">
            {/* Range selector */}
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
                Analytics
              </h2>
              <div className="flex gap-1 border border-zinc-200 rounded-lg p-0.5">
                {(["7d", "30d", "90d", "all"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setAnalyticsRange(r)}
                    className={`px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold rounded-md transition-colors ${
                      analyticsRange === r
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-500 hover:text-zinc-900"
                    }`}
                  >
                    {r === "all" ? "All time" : `Last ${r}`}
                  </button>
                ))}
              </div>
            </div>

            {analyticsLoading && (
              <div className="border border-zinc-200 rounded-xl p-12 flex items-center justify-center text-zinc-400 text-sm">
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Loading analytics…
              </div>
            )}

            {analyticsError && !analyticsLoading && (
              <div className="border border-red-200 bg-red-50 rounded-xl p-6 text-sm text-red-700">
                {analyticsError}
              </div>
            )}

            {!analyticsLoading && !analyticsError && analytics && (
              <>
                {/* Insights / recommendations (no_growth lives on the Followers tab) */}
                {(() => {
                  const filtered = analytics.insights.filter((ins) => ins.type !== "no_growth");
                  if (filtered.length === 0) return null;
                  return (
                    <section className="space-y-3">
                      {filtered.map((ins, idx) => (
                        <div
                          key={idx}
                          className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-4 flex items-start gap-3"
                        >
                          <div className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center flex-shrink-0">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <p className="text-sm text-zinc-700 leading-relaxed pt-1">
                            {ins.message}
                          </p>
                        </div>
                      ))}
                    </section>
                  );
                })()}

                {/* Growth headline stats */}
                <section>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3">
                    Growth
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      {
                        label: "Followers",
                        value: analytics.growth.followerCount,
                        delta: analytics.growth.followersInRange,
                        deltaPct: analytics.growth.followerDeltaPct,
                      },
                      {
                        label: "Members",
                        value: analytics.growth.memberCount,
                        delta: analytics.growth.membersInRange,
                        deltaPct: null,
                      },
                      {
                        label: "RSVPs",
                        value: analytics.engagement.rsvpCount,
                        delta: analytics.growth.rsvpsInRange,
                        deltaPct: analytics.growth.rsvpDeltaPct,
                      },
                      {
                        label: "Active Plans",
                        value: analytics.engagement.planCount,
                        delta: null,
                        deltaPct: null,
                      },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="border border-zinc-200 rounded-xl p-4"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">
                          {stat.label}
                        </p>
                        <p className="text-2xl font-light">{stat.value}</p>
                        {stat.delta != null && (
                          <p
                            className={`text-[11px] mt-1 ${
                              stat.deltaPct == null
                                ? "text-zinc-400"
                                : stat.deltaPct >= 0
                                ? "text-emerald-600"
                                : "text-red-500"
                            }`}
                          >
                            {stat.deltaPct == null
                              ? `+${stat.delta} this period`
                              : `${stat.deltaPct >= 0 ? "+" : ""}${stat.deltaPct}% vs prev`}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                {/* Followers over time */}
                <section className="border border-zinc-200 rounded-xl p-6">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-4">
                    Followers over time
                  </h3>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.growth.followerSeries}>
                        <CartesianGrid stroke="#f4f4f5" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: "#a1a1aa", fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(d) =>
                            new Date(d).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })
                          }
                          minTickGap={30}
                        />
                        <YAxis
                          tick={{ fill: "#a1a1aa", fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                          width={30}
                        />
                        <Tooltip
                          contentStyle={{
                            border: "1px solid #e4e4e7",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          labelFormatter={(d) =>
                            new Date(d).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })
                          }
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#18181b"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                {/* RSVPs by day of week + time of day */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <section className="border border-zinc-200 rounded-xl p-6">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-4">
                      RSVPs by day of week
                    </h3>
                    <div className="h-48 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.whatsWorking.weekdayDistribution}>
                          <CartesianGrid stroke="#f4f4f5" vertical={false} />
                          <XAxis
                            dataKey="day"
                            tick={{ fill: "#a1a1aa", fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            tick={{ fill: "#a1a1aa", fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                            width={30}
                          />
                          <Tooltip
                            contentStyle={{
                              border: "1px solid #e4e4e7",
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                          />
                          <Bar dataKey="value" fill="#18181b" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>

                  <section className="border border-zinc-200 rounded-xl p-6">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-4">
                      RSVPs by time of day
                    </h3>
                    <div className="h-48 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.whatsWorking.timeOfDayDistribution}>
                          <CartesianGrid stroke="#f4f4f5" vertical={false} />
                          <XAxis
                            dataKey="bucket"
                            tick={{ fill: "#a1a1aa", fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(s: string) =>
                              s.charAt(0).toUpperCase() + s.slice(1)
                            }
                          />
                          <YAxis
                            tick={{ fill: "#a1a1aa", fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                            width={30}
                          />
                          <Tooltip
                            contentStyle={{
                              border: "1px solid #e4e4e7",
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                            labelFormatter={(s) => {
                              const str = String(s ?? "");
                              return str.charAt(0).toUpperCase() + str.slice(1);
                            }}
                          />
                          <Bar dataKey="value" fill="#18181b" radius={[6, 6, 0, 0]}>
                            {analytics.whatsWorking.timeOfDayDistribution.map((_, i) => (
                              <Cell key={i} fill="#18181b" />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                </div>

                {/* Engagement summary */}
                <section className="border border-zinc-200 rounded-xl p-6">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-4">
                    Engagement
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-zinc-400 mb-1">
                        Avg RSVPs / plan
                      </p>
                      <p className="text-2xl font-light">{analytics.engagement.rsvpRate}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-zinc-400 mb-1">
                        Repeat attendees
                      </p>
                      <p className="text-2xl font-light">
                        {analytics.engagement.repeatAttendeeCount}
                        <span className="text-sm text-zinc-400 ml-1">
                          / {analytics.engagement.uniqueRsvpUsersInRange}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-zinc-400 mb-1">
                        Repeat rate
                      </p>
                      <p className="text-2xl font-light">
                        {Math.round(analytics.engagement.repeatRate * 100)}%
                      </p>
                    </div>
                  </div>
                </section>

                {/* Top plans */}
                {analytics.engagement.topPlans.length > 0 && (
                  <section className="border border-zinc-200 rounded-xl p-6">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-4">
                      Top plans
                    </h3>
                    <div className="space-y-2">
                      {analytics.engagement.topPlans.map((p, i) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-4 py-2 border-b border-zinc-100 last:border-0"
                        >
                          <span className="text-xs text-zinc-400 w-5">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-zinc-900 truncate">{p.title}</p>
                            <p className="text-[11px] text-zinc-400">{p.category}</p>
                          </div>
                          <span className="text-sm font-medium text-zinc-900">
                            {p.rsvpCount} RSVP{p.rsvpCount === 1 ? "" : "s"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Top categories */}
                {analytics.whatsWorking.topCategories.length > 0 && (
                  <section className="border border-zinc-200 rounded-xl p-6">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-4">
                      Top categories
                    </h3>
                    <div className="h-48 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={analytics.whatsWorking.topCategories}
                          layout="vertical"
                        >
                          <CartesianGrid stroke="#f4f4f5" horizontal={false} />
                          <XAxis
                            type="number"
                            tick={{ fill: "#a1a1aa", fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                          />
                          <YAxis
                            type="category"
                            dataKey="category"
                            tick={{ fill: "#71717a", fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                            width={100}
                          />
                          <Tooltip
                            contentStyle={{
                              border: "1px solid #e4e4e7",
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                          />
                          <Bar dataKey="rsvps" fill="#18181b" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                )}
              </>
            )}
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
                      <div className="flex items-center gap-3">
                        {cal.calendarImage ? (
                          <img src={cal.calendarImage} alt={cal.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                            <Calendar className="w-5 h-5 text-zinc-300" />
                          </div>
                        )}
                        <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-medium ${inactive ? "text-zinc-400" : ""}`}>{cal.name}</h3>
                          {!inactive && (
                            <>
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
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEmbedCalId(embedCalId === cal.objectId ? null : cal.objectId);
                                }}
                                className="text-zinc-300 hover:text-zinc-600 transition-colors"
                                title="Get embed code"
                              >
                                <Code className="w-4 h-4" />
                              </button>
                            </>
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
                              onClick={() => { setEditingCalId(cal.objectId); setEditCalName(cal.name); setEditCalDesc(cal.description || ""); setEditCalSlug(cal.shareId || ""); originalSlugRef.current = cal.shareId || ""; setSlugAvailable(null); setEditCalCity(cal.city || ""); setEditCalCitySelected(false); setEditCalImagePreview(cal.calendarImage || null); setEditCalImageBase64(null); setEditCalRemoveImage(false); setEditCalHideVenue(cal.hideVenueUntilRsvp !== false); setEditCalIsPrivate(cal.isPrivate || false); setEditCalHidePlanIdeas(cal.hidePlanIdeas || false); setEditCalHideCustomPlans(cal.hideCustomPlans || false); }}
                              className="text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1"
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                            <Link
                              href={`/dashboard/${cal.objectId}/plans?orgId=${calendarId}`}
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
                    {embedCalId === cal.objectId && (
                      <div className="border-t border-zinc-100 pt-3 mt-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Embed on Your Website</p>
                        <p className="text-xs text-zinc-500 mb-3">Copy this code and paste it into your website&apos;s HTML to show upcoming events.</p>
                        <div className="relative">
                          <pre className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 pr-20 text-xs text-zinc-600 overflow-x-auto whitespace-pre-wrap break-all">{`<iframe src="${typeof window !== "undefined" ? window.location.origin : ""}/embed/${cal.shareId}" width="100%" height="400" frameborder="0" style="border:none;border-radius:12px;"></iframe>`}</pre>
                          <button
                            onClick={() => {
                              const snippet = `<iframe src="${window.location.origin}/embed/${cal.shareId}" width="100%" height="400" frameborder="0" style="border:none;border-radius:12px;"></iframe>`;
                              navigator.clipboard.writeText(snippet);
                              setToast("Embed code copied!");
                              setTimeout(() => setToast(null), 2000);
                            }}
                            className="absolute top-2 right-2 text-[10px] bg-zinc-900 text-white px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors font-bold uppercase tracking-widest"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ──────── MARKETPLACE TAB ──────── */}
        {activeTab === "marketplace" && (
          <MarketplaceTab
            calendarId={calendarId}
            city={dashboard.calendars.find((c) => c.objectId === calendarId)?.city}
            prefetchedEvents={prefetchedMarketplace}
            orgSettings={{
              name: dashboard.name,
              description: dashboard.description,
              orgType: dashboard.orgType,
              calendarDescription: dashboard.calendars.find((c) => c.objectId === calendarId)?.description || "",
              blacklistCategories: dashboard.blacklistCategories,
              excludeKeywords: dashboard.excludeKeywords,
              daysOfWeek: dashboard.daysOfWeek,
              preferredTimes: dashboard.preferredTimes,
            } satisfies OrgSettings}
            onAddEvent={(event: MarketplaceEvent) => {
              // Gate: require Leaf app connection before creating plans
              if (!leafAppConnected) {
                setShowPhoneModal(true);
                return;
              }

              // Use plan title/description when available (Yelp in recommended view)
              const title = event.planTitle || event.title;
              const description = event.planDescription || event.description;

              // Build a suggested date from suggestedDays (find the next matching day)
              let date = event.suggestedDate || "";
              if (!date && event.suggestedDays?.length > 0) {
                const dayMap: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
                const targetDay = dayMap[event.suggestedDays[0]];
                if (targetDay !== undefined) {
                  const d = new Date();
                  const diff = (targetDay - d.getDay() + 7) % 7 || 7;
                  d.setDate(d.getDate() + diff);
                  date = d.toISOString().slice(0, 10);
                }
              }

              // Build a suggested time from suggestedTimes
              let time = event.suggestedTime || "";
              if (!time && event.suggestedTimes?.length > 0) {
                const timeMap: Record<string, string> = { morning: "10:00 AM", afternoon: "2:00 PM", evening: "7:00 PM", night: "9:00 PM" };
                time = timeMap[event.suggestedTimes[0]] || "";
              }

              setCreatePlanPrefill({
                title,
                description,
                venue: event.venue,
                date,
                time,
                capacity: event.capacityMax?.toString() || "",
                imageUrl: event.image,
              });
              setShowCreatePlanModal(true);
            }}
          />
        )}

        {/* ──────── SETTINGS TAB ──────── */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            {/* Settings sub-tabs */}
            <div className="flex gap-1 border-b border-zinc-100">
              <button
                onClick={() => setSettingsSection("general")}
                className={`px-4 py-2 text-xs font-medium uppercase tracking-widest border-b-2 transition-colors ${
                  settingsSection === "general"
                    ? "border-zinc-900 text-zinc-900"
                    : "border-transparent text-zinc-400 hover:text-zinc-600"
                }`}
              >
                General
              </button>
              <button
                onClick={() => setSettingsSection("subscription")}
                className={`px-4 py-2 text-xs font-medium uppercase tracking-widest border-b-2 transition-colors ${
                  settingsSection === "subscription"
                    ? "border-zinc-900 text-zinc-900"
                    : "border-transparent text-zinc-400 hover:text-zinc-600"
                }`}
              >
                Subscription
              </button>
            </div>

            {settingsSection === "general" && (
            <div className="space-y-8">
            {/* Phone / Leaf App Connection */}
            <div className="flex items-center justify-between py-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <Smartphone className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-xs text-zinc-500">Connected to Leaf app</span>
                <a href="https://apps.apple.com/us/app/leaf-build-your-community/id1040588046" target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-400 hover:text-zinc-600 underline">Visit App Store</a>
              </div>
              {leafAppConnected ? (
                <div className="flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-green-600" />
                  <span className="text-xs text-green-700">Phone number verified</span>
                </div>
              ) : (
                <button
                  onClick={() => setShowPhoneModal(true)}
                  className="text-xs text-zinc-500 hover:text-zinc-900 underline"
                >
                  Connect phone
                </button>
              )}
            </div>

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

            {/* AI Idea Generation */}
            <div className="relative">
              {!isGrowthPlus && (
                <div className="absolute top-4 right-4 z-10" onClick={() => setShowSubscription(true)}>
                  <div className="flex items-center gap-2 bg-zinc-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:bg-zinc-800 transition-colors">
                    <Lock className="w-3 h-3" /> Upgrade
                  </div>
                </div>
              )}
              <section className={`border border-zinc-200 rounded-xl p-6 space-y-8 ${!isGrowthPlus ? "opacity-40 pointer-events-none" : ""}`}>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Automated Plan Ideas</h2>
                  <p className="text-xs text-zinc-500 mt-1">Control how Leaf generates plan ideas for your community.</p>
                </div>

                {/* Preferred Days */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-700 mb-1">Preferred Days</h3>
                  <p className="text-xs text-zinc-500 mb-3">Automated scheduling will be limited to these timeframes.</p>
                  <div className="flex gap-2 flex-wrap">
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
                </div>

                {/* Preferred Times */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-700 mb-1">Preferred Times</h3>
                  <p className="text-xs text-zinc-500 mb-3">Suggested days & time will only fall during these designated windows.</p>
                  <div className="flex gap-2 flex-wrap">
                    {TIME_OF_DAY_OPTIONS.map((opt) => {
                      const active = settingsPreferredTimes.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          onClick={() => {
                            setSettingsPreferredTimes((prev) =>
                              active ? prev.filter((t) => t !== opt.id) : [...prev, opt.id]
                            );
                          }}
                          className={`px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors flex flex-col items-center gap-0.5 ${
                            active
                              ? "bg-zinc-900 text-white"
                              : "border border-zinc-200 text-zinc-400 hover:border-zinc-300"
                          }`}
                        >
                          <span>{opt.label}</span>
                          <span className={`text-[9px] font-normal normal-case tracking-normal ${active ? "text-zinc-300" : "text-zinc-400"}`}>
                            {opt.hint}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Blacklisted Categories */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-700 mb-1">Excluded Venue Categories</h3>
                  <p className="text-xs text-zinc-500 mb-3">These categories will be omitted from the suggestion engine.</p>
                  <div className="flex gap-2 flex-wrap">
                    {BLACKLIST_PRESETS.map((cat) => {
                      const active = settingsBlacklistCategories.includes(cat);
                      return (
                        <button
                          key={cat}
                          onClick={() => {
                            setSettingsBlacklistCategories((prev) =>
                              active ? prev.filter((c) => c !== cat) : [...prev, cat]
                            );
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                            active
                              ? "bg-red-600 text-white border border-red-600"
                              : "border border-zinc-200 text-zinc-500 hover:border-zinc-300"
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Excluded Keywords */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-700 mb-1">Excluded Keywords</h3>
                  <p className="text-xs text-zinc-500 mb-3">AI won&apos;t suggest plans involving these topics (e.g. wine, drinking, gambling).</p>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={excludeKeywordInput}
                      onChange={(e) => setExcludeKeywordInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const kw = excludeKeywordInput.trim().toLowerCase();
                          if (kw && !settingsExcludeKeywords.includes(kw)) {
                            setSettingsExcludeKeywords((prev) => [...prev, kw]);
                          }
                          setExcludeKeywordInput("");
                        }
                      }}
                      placeholder="Type a keyword and press Enter"
                      className="flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const kw = excludeKeywordInput.trim().toLowerCase();
                        if (kw && !settingsExcludeKeywords.includes(kw)) {
                          setSettingsExcludeKeywords((prev) => [...prev, kw]);
                        }
                        setExcludeKeywordInput("");
                      }}
                      className="px-4 py-2 bg-zinc-900 text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-zinc-800 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  {settingsExcludeKeywords.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {settingsExcludeKeywords.map((kw) => (
                        <span
                          key={kw}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-600 text-white"
                        >
                          {kw}
                          <button
                            type="button"
                            onClick={() => setSettingsExcludeKeywords((prev) => prev.filter((k) => k !== kw))}
                            className="hover:text-red-200 transition-colors"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Photo Style */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-700 mb-1">Photo Style</h3>
                  <p className="text-xs text-zinc-500 mb-3">Control what kind of images AI selects for plan ideas.</p>
                  <div className="flex gap-2 flex-wrap">
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
                </div>
              </section>
            </div>

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

            {settingsSection === "subscription" && (
            <div className="space-y-8">
              <section className="border border-zinc-200 rounded-xl p-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-2">Current Plan</h2>
                <p className="text-2xl font-light mb-1">{tierLabel}</p>
                <p className="text-xs text-zinc-500">
                  {dashboard.tier === "starter"
                    ? "Free — basic features"
                    : dashboard.tier === "growth"
                    ? "$4.99/month — premium look & app chat"
                    : "$29.99/month — full features"}
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
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs bg-zinc-100 px-2 py-0.5 rounded-full">
                                {m.status}
                              </span>
                              {m.leafAppConnected && (
                                <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                                  Synced to app
                                </span>
                              )}
                            </div>
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
            {/* Calendar filter — shared by pending + approved sections */}
            {dashboard.calendars.length > 1 && (
              <div className="flex justify-end">
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
              </div>
            )}
            {/* Pending follow requests */}
            {(() => {
              const filteredPending = followerCalFilter === "all"
                ? dashboard.pendingFollowers
                : dashboard.pendingFollowers.filter((pf) => pf.calendarId === followerCalFilter);
              if (filteredPending.length === 0) return null;
              return (
              <section>
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4">
                  Pending Requests ({filteredPending.length})
                </h2>
                <div className="border border-amber-200 bg-amber-50/40 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-amber-50 text-xs uppercase tracking-widest text-zinc-400">
                      <tr>
                        <th className="text-left px-4 py-3 font-bold">Name</th>
                        {dashboard.calendars.length > 1 && followerCalFilter === "all" && (
                          <th className="text-left px-4 py-3 font-bold">Calendar</th>
                        )}
                        <th className="text-left px-4 py-3 font-bold">Requested</th>
                        <th className="text-right px-4 py-3 font-bold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100">
                      {filteredPending.map((pf) => (
                        <tr key={pf.membershipId}>
                          <td className="px-4 py-3">{pf.name}</td>
                          {dashboard.calendars.length > 1 && followerCalFilter === "all" && (
                            <td className="px-4 py-3 text-zinc-400">{pf.calendarName || "—"}</td>
                          )}
                          <td className="px-4 py-3 text-zinc-400">
                            {new Date(pf.requestedAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                            <button
                              onClick={async () => {
                                try {
                                  await Parse.Cloud.run("approveFollowerRequest", {
                                    calendarId: pf.calendarId || calendarId,
                                    membershipId: pf.membershipId,
                                  });
                                  setDashboard((d) => d ? {
                                    ...d,
                                    pendingFollowers: d.pendingFollowers.filter((x) => x.membershipId !== pf.membershipId),
                                    pendingFollowerCount: d.pendingFollowerCount - 1,
                                    followers: [...d.followers, { membershipId: pf.membershipId, objectId: pf.objectId, name: pf.name, phone: pf.phone, calendarId: pf.calendarId, calendarName: pf.calendarName, joinedAt: new Date().toISOString() }],
                                    followerCount: d.followerCount + 1,
                                    calendars: d.calendars.map((c) => c.objectId === pf.calendarId ? { ...c, pendingFollowerCount: Math.max(0, c.pendingFollowerCount - 1) } : c),
                                  } : d);
                                  setToast("Follower approved!");
                                  setTimeout(() => setToast(null), 2000);
                                } catch (err) {
                                  console.error("Failed to approve follower:", err);
                                  alert(err instanceof Error ? err.message : "Failed to approve.");
                                }
                              }}
                              className="bg-zinc-900 text-white px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] font-bold rounded-lg hover:bg-zinc-800 transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  await Parse.Cloud.run("rejectFollowerRequest", {
                                    calendarId: pf.calendarId || calendarId,
                                    membershipId: pf.membershipId,
                                  });
                                  setDashboard((d) => d ? {
                                    ...d,
                                    pendingFollowers: d.pendingFollowers.filter((x) => x.membershipId !== pf.membershipId),
                                    pendingFollowerCount: d.pendingFollowerCount - 1,
                                    calendars: d.calendars.map((c) => c.objectId === pf.calendarId ? { ...c, pendingFollowerCount: Math.max(0, c.pendingFollowerCount - 1) } : c),
                                  } : d);
                                  setToast("Request rejected.");
                                  setTimeout(() => setToast(null), 2000);
                                } catch (err) {
                                  console.error("Failed to reject follower:", err);
                                }
                              }}
                              className="text-zinc-300 hover:text-red-500 transition-colors text-[10px] uppercase tracking-[0.15em] font-bold px-3 py-1.5 border border-zinc-200 rounded-lg hover:border-red-200"
                            >
                              Reject
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              );
            })()}
            <section>
              {(() => {
                const filteredFollowers = followerCalFilter === "all"
                  ? dashboard.followers
                  : dashboard.followers.filter((f) => f.calendarId === followerCalFilter);
                const calendarNames = [...new Map(dashboard.followers.filter((f) => f.calendarId).map((f) => [f.calendarId, f.calendarName])).entries()];
                const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
                const newFollowersInRange = filteredFollowers.filter(
                  (f) => f.joinedAt && new Date(f.joinedAt).getTime() >= thirtyDaysAgo
                ).length;
                const showNoGrowthCallout = filteredFollowers.length > 0 && newFollowersInRange === 0;
                return (<>
              {showNoGrowthCallout && (
                <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-4 flex items-start gap-3 mb-4">
                  <div className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <p className="text-sm text-zinc-700 leading-relaxed pt-1">
                    No new followers in the last 30 days. Share your calendar link to drive new sign-ups.
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
                  Followers ({filteredFollowers.length})
                </h2>
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
          <div className="bg-white w-full max-w-lg rounded-t-2xl md:rounded-xl p-8 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditingCalId(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-zinc-100"
            >
              <Plus className="w-5 h-5 rotate-45" />
            </button>
            <h2 className="text-xl font-light tracking-tight mb-6">Edit Calendar</h2>
            <div className="space-y-4">
              {/* Calendar image */}
              <div className="flex items-center gap-4">
                <div className="relative group">
                  {editCalImagePreview ? (
                    <img src={editCalImagePreview} alt="Calendar" className="w-16 h-16 rounded-xl object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-zinc-100 flex items-center justify-center">
                      <ImagePlus className="w-6 h-6 text-zinc-300" />
                    </div>
                  )}
                  <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <ImagePlus className="w-5 h-5 text-white" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5MB"); return; }
                        const reader = new FileReader();
                        reader.onload = () => {
                          const result = reader.result as string;
                          setEditCalImagePreview(result);
                          setEditCalImageBase64(result.split(",")[1]);
                          setEditCalRemoveImage(false);
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-zinc-500">Calendar image</p>
                  <p className="text-[10px] text-zinc-400">Overrides org logo on public page</p>
                  {editCalImagePreview && (
                    <button
                      onClick={() => { setEditCalImagePreview(null); setEditCalImageBase64(null); setEditCalRemoveImage(true); }}
                      className="text-[10px] text-red-500 hover:text-red-700 mt-1"
                    >
                      Remove image
                    </button>
                  )}
                </div>
              </div>

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
              {dashboard?.tier === "pro" && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">City</label>
                  <CityAutocomplete
                    value={editCalCity}
                    onChange={(v) => { setEditCalCity(v); setEditCalCitySelected(false); }}
                    onSelect={(place) => { setEditCalCity(place.description); setEditCalCitySelected(true); }}
                    className="w-full border-b border-zinc-300 py-2 text-lg font-light focus:outline-none focus:border-zinc-900"
                    placeholder="Enter a city"
                  />
                </div>
              )}
              {/* Venue privacy toggle */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-xs font-medium text-zinc-700">Hide venue until RSVP</p>
                  <p className="text-[10px] text-zinc-400">Show only neighborhood on public page</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditCalHideVenue(!editCalHideVenue)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${editCalHideVenue ? "bg-zinc-900" : "bg-zinc-200"}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${editCalHideVenue ? "left-5" : "left-0.5"}`} />
                </button>
              </div>
              {/* Private calendar toggle */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-xs font-medium text-zinc-700">Private calendar</p>
                  <p className="text-[10px] text-zinc-400">Visitors must request to follow before seeing plans</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditCalIsPrivate(!editCalIsPrivate)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${editCalIsPrivate ? "bg-zinc-900" : "bg-zinc-200"}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${editCalIsPrivate ? "left-5" : "left-0.5"}`} />
                </button>
              </div>
              {/* Show Plan Ideas toggle */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-xs font-medium text-zinc-700">Show plan ideas</p>
                  <p className="text-[10px] text-zinc-400">Let members browse and host AI-generated plan ideas</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditCalHidePlanIdeas(!editCalHidePlanIdeas)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${!editCalHidePlanIdeas ? "bg-zinc-900" : "bg-zinc-200"}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${!editCalHidePlanIdeas ? "left-5" : "left-0.5"}`} />
                </button>
              </div>
              {!editCalHidePlanIdeas && (
                <button
                  type="button"
                  onClick={() => { setEditingCalId(null); setActiveTab("settings"); }}
                  className="text-[10px] text-zinc-400 hover:text-zinc-600 transition-colors underline -mt-2.5"
                >
                  Automated plan idea settings
                </button>
              )}
              {/* Custom Plan Proposals toggle */}
              {dashboard.tier === "pro" ? (
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-xs font-medium text-zinc-700">Custom plan proposals</p>
                    <p className="text-[10px] text-zinc-400">Let members propose their own plan ideas for your review</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditCalHideCustomPlans(!editCalHideCustomPlans)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${!editCalHideCustomPlans ? "bg-zinc-900" : "bg-zinc-200"}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${!editCalHideCustomPlans ? "left-5" : "left-0.5"}`} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-xs font-medium text-zinc-400">Custom plan proposals</p>
                    <p className="text-[10px] text-zinc-300">Let members propose their own plan ideas for your review</p>
                  </div>
                  <button
                    onClick={() => setShowSubscription(true)}
                    className="flex items-center gap-1.5 bg-zinc-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors"
                  >
                    <Lock className="w-3 h-3" /> Upgrade
                  </button>
                </div>
              )}

              <button
                onClick={handleSaveCalendar}
                disabled={!editCalName || savingCal || (editCalSlug !== originalSlugRef.current && (slugAvailable === false || slugChecking))}
                className="w-full bg-zinc-900 text-white py-3 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors disabled:opacity-50 mt-2"
              >
                {savingCal ? "Saving..." : "Save Changes"}
              </button>

              {/* Delete calendar — only for non-primary sub-calendars */}
              {!dashboard.calendars.find((c) => c.objectId === editingCalId)?.isPrimary && (
                <button
                  onClick={async () => {
                    const calName = dashboard.calendars.find((c) => c.objectId === editingCalId)?.name || "this calendar";
                    if (!confirm(`Permanently delete "${calName}"? This will remove all its plans, followers, and data. This cannot be undone.`)) return;
                    try {
                      await Parse.Cloud.run("deleteCalendar", { calendarId: editingCalId, orgId: calendarId });
                      setEditingCalId(null);
                      fetchDashboard();
                    } catch (err) {
                      console.error("Failed to delete calendar:", err);
                      alert(err instanceof Error ? err.message : "Failed to delete calendar.");
                    }
                  }}
                  className="w-full text-center py-2 mt-3 text-xs font-bold uppercase tracking-widest text-red-500 hover:text-red-700 transition-colors"
                >
                  Delete Calendar
                </button>
              )}
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
                    <Users className="w-4 h-4" /> {planRsvpsLoading ? selectedActivePlan.rsvpCount : planRsvps.length} RSVP{planRsvps.length === 1 ? "" : "s"}
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

              {/* RSVPs */}
              <div className="space-y-3">
                <h4 className="text-[10px] tracking-[0.3em] uppercase font-bold text-zinc-400">
                  Attendees {!planRsvpsLoading && `(${planRsvps.filter(r => r.status === "Accepted").length})`}
                  {!planRsvpsLoading && planRsvps.some(r => r.status === "pendingRsvp") && (
                    <span className="text-amber-500 ml-2">
                      {planRsvps.filter(r => r.status === "pendingRsvp").length} pending
                    </span>
                  )}
                </h4>
                {planRsvpsLoading ? (
                  <p className="text-sm text-zinc-400">Loading...</p>
                ) : planRsvps.length > 0 ? (
                  <div className="border border-zinc-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-50 text-left">
                        <tr>
                          <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Name</th>
                          <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Phone</th>
                          <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Status</th>
                          <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {planRsvps.map((r, i) => (
                          <tr key={i}>
                            <td className="px-4 py-2.5">
                              <div>{r.name}</div>
                              {r.rsvpNote && (
                                <p className="text-[11px] text-zinc-400 italic truncate max-w-[200px]">&ldquo;{r.rsvpNote}&rdquo;</p>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-zinc-400">{r.phone || "—"}</td>
                            <td className="px-4 py-2.5">
                              {r.status === "pendingRsvp" ? (
                                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Pending</span>
                              ) : (
                                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Confirmed</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              {r.status === "pendingRsvp" && (
                                <div className="flex gap-2">
                                  <button
                                    onClick={async () => {
                                      try {
                                        await Parse.Cloud.run("approveRsvpRequest", { notificationId: r.notificationId });
                                        setPlanRsvps((prev) => prev.map((rsvp) => rsvp.notificationId === r.notificationId ? { ...rsvp, status: "Accepted" } : rsvp));
                                        setDashboard((d) => d ? { ...d, pendingRsvpRequests: d.pendingRsvpRequests.filter((pr) => pr.notificationId !== r.notificationId) } : d);
                                      } catch (err) {
                                        console.error("Failed to approve:", err);
                                      }
                                    }}
                                    className="px-2 py-1 bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-widest rounded hover:bg-emerald-700 transition-colors"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={async () => {
                                      try {
                                        await Parse.Cloud.run("declineRsvpRequest", { notificationId: r.notificationId });
                                        setPlanRsvps((prev) => prev.filter((rsvp) => rsvp.notificationId !== r.notificationId));
                                        setDashboard((d) => d ? { ...d, pendingRsvpRequests: d.pendingRsvpRequests.filter((pr) => pr.notificationId !== r.notificationId) } : d);
                                      } catch (err) {
                                        console.error("Failed to decline:", err);
                                      }
                                    }}
                                    className="px-2 py-1 bg-white text-zinc-600 text-[10px] font-bold uppercase tracking-widest rounded border border-zinc-300 hover:bg-zinc-50 transition-colors"
                                  >
                                    Decline
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400">No RSVPs yet.</p>
                )}
              </div>

              <div className="pt-8 border-t border-zinc-100 flex items-center justify-between">
                <button
                  onClick={() => {
                    if (!leafAppConnected) {
                      setShowPhoneModal(true);
                      return;
                    }
                    setCreatePlanPrefill({
                      title: selectedActivePlan.title,
                      description: selectedActivePlan.description,
                      venue: selectedActivePlan.location,
                      imageUrl: selectedActivePlan.image,
                    });
                    setSelectedActivePlan(null);
                    setShowCreatePlanModal(true);
                  }}
                  className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Duplicate
                </button>
                <button
                  onClick={() => {
                    const planDate = selectedActivePlan.date ? new Date(selectedActivePlan.date).toISOString().split("T")[0] : "";
                    setEditingPlanId(selectedActivePlan.objectId);
                    setCreatePlanPrefill({
                      title: selectedActivePlan.title,
                      description: selectedActivePlan.description,
                      venue: selectedActivePlan.location,
                      date: planDate,
                      time: selectedActivePlan.time || "",
                      imageUrl: selectedActivePlan.image,
                    });
                    setSelectedActivePlan(null);
                    setShowCreatePlanModal(true);
                  }}
                  className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={async () => {
                    if (!confirm("Cancel this plan? Attendees will be notified. This cannot be undone.")) return;
                    try {
                      await Parse.Cloud.run("removePlanFromCalendar", { eventGroupId: selectedActivePlan.objectId });
                      setSelectedActivePlan(null);
                      fetchDashboard();
                    } catch (err) {
                      console.error("Failed to cancel plan:", err);
                      alert("Failed to cancel plan.");
                    }
                  }}
                  className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-500 hover:text-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Cancel Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Plan Modal (marketplace + duplicate) */}
      {showCreatePlanModal && (
        <CreatePlanModal
          calendarId={calendarId}
          calendars={dashboard.calendars.map((c) => ({ objectId: c.objectId, name: c.name }))}
          tier={dashboard.tier}
          prefill={createPlanPrefill}
          hideVenueDefault={dashboard.calendars.find((c) => c.objectId === calendarId)?.hideVenueUntilRsvp}
          editMode={!!editingPlanId}
          eventGroupId={editingPlanId || undefined}
          onClose={() => { setShowCreatePlanModal(false); setCreatePlanPrefill(null); setEditingPlanId(null); }}
          onCreated={() => fetchDashboard()}
        />
      )}

      {/* Phone Verification Modal */}
      {showPhoneModal && (
        <PhoneVerificationModal
          onVerified={() => { setLeafAppConnected(true); setShowPhoneModal(false); setPhoneJustVerified(true); }}
          onClose={() => setShowPhoneModal(false)}
        />
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
