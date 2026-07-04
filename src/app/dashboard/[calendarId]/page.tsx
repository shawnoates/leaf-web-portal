"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import CityAutocomplete from "@/components/CityAutocomplete";
import SubscriptionModal from "@/components/SubscriptionModal";
import ConciergeDashboardBanner from "@/components/ConciergeDashboardBanner";
import ConciergeMenuCard, { type ConciergeMenu } from "@/components/ConciergeMenuCard";
import ConciergeThread from "@/components/ConciergeThread";
import PlansManager from "@/components/PlansManager";
import ConciergeEventReports from "@/components/ConciergeEventReports";
import MarketplaceTab, { type MarketplaceEvent, type OrgSettings } from "@/components/MarketplaceTab";
import CreatePlanModal, { type CreatePlanPrefill } from "@/components/CreatePlanModal";
import PlanDetailModal from "@/components/PlanDetailModal";
import PhoneVerificationModal from "@/components/PhoneVerificationModal";
import { processImageFile, IMAGE_ACCEPT } from "@/lib/image-utils";
import { formatDateInputInTimezone } from "@/lib/date-utils";
import {
  Calendar,
  Check,
  ChevronDown,
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
  Megaphone,
  Ticket,
  Phone,
  Smartphone,
  Vote,
  X,
  MessageCircle,
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
  /** The single calendar the concierge host runs (null unless on concierge). */
  conciergeServicedCalendarId: string | null;
  subscriptionStatus: string | null;
  subscriptionCancelAt: number | null;
  billingInterval: string | null; // "month" or "year"
  isOwner: boolean;
  isOrgCoHost: boolean;
  viewerCalendarRole: "Owner" | "Host" | null;
  calendarRoles: Record<string, "Owner" | "Host">;
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
  hideDeals: boolean;
  memberCount: number;
  totalRsvpCount: number;
  rsvpLimit: number | null;
  rsvpsThisMonth: number;
  planIdeaCount: number;
  upcomingPlanCount: number;
  followerCount: number;
  members: {
    membershipId: string | null;
    objectId: string | null;
    name: string;
    email: string | null;
    status: string;
    leafAppConnected?: boolean;
    joinedAt: string;
    pending?: boolean;
    scope?: {
      allCalendars: boolean;
      calendars: { id: string; name: string }[];
      membershipIds: string[];
    };
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
    role: "Owner" | "Host";
    calendarImage: string | null;
    hideVenueUntilRsvp: boolean;
    requireApprovalDefault: boolean;
    isPrivate: boolean;
    hidePlanIdeas: boolean;
    hideCustomPlans: boolean;
    hideDeals: boolean;
    merchantEventsOptOut: boolean;
    merchantEventsRequireApproval: boolean;
    pendingFollowerCount: number;
    isConciergeServiced?: boolean;
  }[];
  calendarLimit: number | null;
  hostRequests: {
    planId: string;
    title: string;
    description: string;
    image: string | null;
    calendarName: string | null;
    calendarId: string | null;
    requesterName: string;
    requesterPhone: string | null;
    requestedDate: string | null;
    requestedNote: string | null;
    requestedVenue: { name: string; address: string; placeId?: string | null } | null;
    requestedCapacity: number | null;
    requestedRequireApproval: boolean;
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
  recentPhotos: {
    objectId: string;
    url: string | null;
    uploadedAt: string;
    uploaderName: string;
    eventGroupId: string | null;
    eventTitle: string;
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
  { id: "marketplace", label: "Marketplace", icon: Ticket, paidOnly: true },
  { id: "settings", label: "Settings", icon: Settings, ownerOnly: true },
];

// Tiers that unlock paid features. Concierge includes everything in Pro, and
// `growth` is the retired Social tier treated as Pro.
const PAID_TIERS = ["pro", "growth", "concierge"];

type CalActivePlan = { objectId: string; title: string; description: string; image: string | null; date: string; timezone: string | null; time: string | null; hostName: string; rsvpCount: number; location: { name: string; address: string; placeId?: string | null } | null; isPoll?: boolean; pollPostId?: string | null; pollOptionCount?: number; pollVoteCount?: number; pollClosesAt?: string | null; hideVenueUntilRsvp?: boolean; requireApproval?: boolean; planSeriesId?: string | null };

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
    pageViewCount: number;
    pageViewsInRange: number;
    pageViewDeltaPct: number;
    followerSeries: AnalyticsSeriesPoint[];
    rsvpSeries: AnalyticsSeriesPoint[];
    pageViewSeries: AnalyticsSeriesPoint[];
  };
  engagement: {
    rsvpCount: number;
    planCount: number;
    rsvpRate: number;
    attendanceCount: number;
    attendanceRate: number;
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
  // Mirror of `dashboard` for use inside stable callbacks without re-creating
  // them (see fetchDashboard's stale-while-revalidate check).
  const dashboardRef = useRef<OrgDashboard | null>(null);
  useEffect(() => { dashboardRef.current = dashboard; }, [dashboard]);
  // Per-calendar cache key for the last successful getOrgDashboard payload.
  const dashboardCacheKey = `org_dashboard_cache_${calendarId}`;
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
  // Pending business-event requests for THIS org's primary calendar.
  // The banner links to the primary calendar's edit page where owners can
  // review + decide. Per-child-calendar approvals live on each child's own
  // edit page.
  const [eventApprovals, setEventApprovals] = useState<
    {
      objectId: string;
      eventTitle: string;
      businessName: string | null;
      eventDate: string | null;
    }[]
  >([]);

  const loadEventApprovals = useCallback(async () => {
    try {
      const r: { approvals?: typeof eventApprovals } = await Parse.Cloud.run(
        "listCalendarEventApprovals",
        { calendarId }
      );
      setEventApprovals(r.approvals || []);
    } catch {
      /* not permitted / none — leave empty */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarId]);
  useEffect(() => {
    // Load once on mount so the top banner can surface pending requests from
    // any tab. Server-gated to the owner; non-owners get an empty list.
    loadEventApprovals();
  }, [loadEventApprovals]);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSection, setSettingsSection] = useState<"general" | "subscription">("general");

  // Migration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const [embedCalId, setEmbedCalId] = useState<string | null>(null);

  // Analytics
  const [analytics, setAnalytics] = useState<OrgAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsRange, setAnalyticsRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [analyticsCalFilter, setAnalyticsCalFilter] = useState<string>("all");

  // Dismissed insights — persisted per-calendar in localStorage. Key per
  // insight is `${type}|${message}` so when the underlying insight changes
  // (different top category, different best day, etc.) the new one shows
  // even if the prior was dismissed.
  const dismissedStorageKey = `analytics_dismissed_${calendarId}`;
  const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(dismissedStorageKey);
      if (raw) setDismissedInsights(new Set(JSON.parse(raw)));
    } catch { /* ignore */ }
  }, [dismissedStorageKey]);
  const dismissInsight = useCallback((key: string) => {
    setDismissedInsights((prev) => {
      const next = new Set(prev);
      next.add(key);
      try { localStorage.setItem(dismissedStorageKey, JSON.stringify([...next])); } catch { /* quota */ }
      return next;
    });
  }, [dismissedStorageKey]);

  // Modals
  const [showAddCalendar, setShowAddCalendar] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [cancelAt, setCancelAt] = useState<number | null>(null);

  // Add calendar form
  const [newCalName, setNewCalName] = useState("");
  const [newCalDesc, setNewCalDesc] = useState("");
  const [newCalCity, setNewCalCity] = useState("");
  const [newCalCitySelected, setNewCalCitySelected] = useState(false);
  // Captured for apartment_complex orgs so each sub-calendar has its own
  // geo (different building = different radius matching for deals).
  const [newCalLat, setNewCalLat] = useState<number | null>(null);
  // Defaults to ON (show deals). Owner can flip off in the create form for
  // calendars where deals aren't relevant (e.g., a remote book club).
  const [newCalHideDeals, setNewCalHideDeals] = useState(false);
  const [newCalLng, setNewCalLng] = useState<number | null>(null);
  const [addingCalendar, setAddingCalendar] = useState(false);

  // Regenerate (per calendar)
  const [regeneratingCalId, setRegeneratingCalId] = useState<string | null>(null);

  // Plan detail modal
  const [selectedActivePlan, setSelectedActivePlan] = useState<{
    objectId: string;
    title: string;
    description: string;
    image: string | null;
    date: string;
    timezone: string | null;
    time: string | null;
    hostName: string;
    rsvpCount: number;
    location: { name: string; address: string; placeId?: string | null } | null;
    isPoll?: boolean;
    pollVoteCount?: number;
    pollOptionCount?: number;
    pollClosesAt?: string | null;
    hideVenueUntilRsvp?: boolean;
    requireApproval?: boolean;
    planSeriesId?: string | null;
  } | null>(null);
  // Create plan modal (used by marketplace + duplicate)
  const [createPlanPrefill, setCreatePlanPrefill] = useState<CreatePlanPrefill | null>(null);
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editingHostRequestId, setEditingHostRequestId] = useState<string | null>(null);
  const [editingHostRequestCalendarId, setEditingHostRequestCalendarId] = useState<string | null>(null);
  // Poll → plan conversion. When set, CreatePlanModal opens in pollConvertMode
  // pre-filled with the poll's data and the winning date.
  const [pollConvertEventGroupId, setPollConvertEventGroupId] = useState<string | null>(null);
  const [pollConvertWinningDate, setPollConvertWinningDate] = useState<string | null>(null);
  const [pollConvertWinningTime, setPollConvertWinningTime] = useState<string | null>(null);

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
  // Scope picker: All Calendars (org-wide) or specific calendar ids.
  const [inviteScopeAll, setInviteScopeAll] = useState(true);
  const [inviteScopeIds, setInviteScopeIds] = useState<string[]>([]);
  const [inviteScopeOpen, setInviteScopeOpen] = useState(false);

  // Edit-scope popover
  const [editScopeFor, setEditScopeFor] = useState<{
    name: string;
    userId: string | null;
    email: string | null;
  } | null>(null);
  const [editScopeAll, setEditScopeAll] = useState(true);
  const [editScopeIds, setEditScopeIds] = useState<string[]>([]);
  const [savingScope, setSavingScope] = useState(false);

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

  // Hydrate instantly from the last-known dashboard so returning owners see
  // their data on paint instead of a blank spinner; fetchDashboard then
  // revalidates in the background.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(dashboardCacheKey);
      if (raw) {
        const cached = JSON.parse(raw);
        dashboardRef.current = cached; // sync, so fetchDashboard skips the spinner
        setDashboard(cached);
        setLoading(false);
      }
    } catch { /* corrupt cache — ignore, fall back to network */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarId]);

  const fetchDashboard = useCallback(async () => {
    // Only block the whole page on the spinner when we have nothing to show.
    // If a cached (or already-loaded) dashboard is on screen, revalidate in the
    // background so login feels instant instead of staring at a spinner.
    if (!dashboardRef.current) setLoading(true);
    try {
      const result = await Parse.Cloud.run("getOrgDashboard", { calendarId });
      setDashboard(result);
      try {
        localStorage.setItem(dashboardCacheKey, JSON.stringify(result));
      } catch { /* quota / serialization — cache is best-effort */ }
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
      if (result.leafAppConnected) setLeafAppConnected(true);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load dashboard";
      // A background revalidation failure shouldn't wipe out a cached dashboard
      // that's already on screen — only surface the error screen when we have
      // nothing to show.
      if (!dashboardRef.current) setError(message);
      else console.warn("[Dashboard] background refresh failed:", message);
    } finally {
      setLoading(false);
    }
    // dashboardCacheKey is derived from calendarId, so [calendarId] is exhaustive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarId]);

  useEffect(() => {
    if (user) fetchDashboard();
  }, [user, fetchDashboard]);

  // Legacy compat: ?editCal=<id> used to open a modal on this page. The
  // edit surface is now its own route — redirect once dashboard is loaded
  // enough to know the calendar exists and is accessible.
  useEffect(() => {
    if (!dashboard) return;
    const editCalParam = searchParams.get("editCal");
    if (!editCalParam) return;
    const cal = dashboard.calendars.find((c) => c.objectId === editCalParam);
    if (cal) {
      router.replace(`/dashboard/${calendarId}/calendars/${cal.objectId}/edit`);
    }
  }, [dashboard, searchParams, router, calendarId]);

  // Auto-open the plan detail modal when ?openPoll=<eventGroupId> is in the URL.
  // Used by the "Pick a date" button in the poll-expired notification email.
  const autoOpenedPollRef = useRef<string | null>(null);
  useEffect(() => {
    if (!dashboard) return;
    const pollId = searchParams.get("openPoll");
    if (!pollId || autoOpenedPollRef.current === pollId) return;
    type ActivePlan = NonNullable<typeof selectedActivePlan>;
    for (const cal of dashboard.calendars) {
      const plans = (cal as Record<string, unknown>).activePlans as ActivePlan[] | undefined;
      const match = plans?.find((p) => p.objectId === pollId);
      if (match) {
        setSelectedActivePlan(match);
        setActiveTab("calendars");
        autoOpenedPollRef.current = pollId;
        break;
      }
    }
  }, [dashboard, searchParams]);

  // Manage-plans slide-over — opened from the Calendars tab; replaces the old
  // standalone /dashboard/[calendarId]/plans route. ?managePlans=<calId>
  // auto-opens it, carrying prefill/returnTo for the /m "Host Another"
  // deep-link (which used to target the /plans page).
  const [managePlansCalId, setManagePlansCalId] = useState<string | null>(null);
  const [managePlansPrefill, setManagePlansPrefill] = useState<CreatePlanPrefill | null>(null);
  const [managePlansReturnTo, setManagePlansReturnTo] = useState<string | null>(null);
  // Concierge chat slide-over — the serviced calendar looks like any other; the
  // concierge conversation opens as a drawer from its "Concierge" button.
  const [showConciergeChat, setShowConciergeChat] = useState(false);
  const managePlansOpenedRef = useRef(false);
  useEffect(() => {
    if (!dashboard || managePlansOpenedRef.current) return;
    const mp = searchParams.get("managePlans");
    if (!mp) return;
    managePlansOpenedRef.current = true;
    const prefillTitle = searchParams.get("prefillTitle");
    let prefill: CreatePlanPrefill | null = null;
    if (prefillTitle) {
      let venue: { name: string; address: string } | null = null;
      const venueStr = searchParams.get("prefillVenue");
      if (venueStr) {
        try {
          const v = JSON.parse(venueStr);
          venue = { name: v.name, address: v.address };
        } catch {
          // Invalid venue JSON — ignore
        }
      }
      prefill = {
        title: prefillTitle,
        description: searchParams.get("prefillDescription") || "",
        date: searchParams.get("prefillDate") || "",
        time: searchParams.get("prefillTime") || "",
        capacity: searchParams.get("prefillCapacity") || "",
        venue,
      };
    }
    setManagePlansPrefill(prefill);
    setManagePlansReturnTo(searchParams.get("returnTo"));
    setManagePlansCalId(mp);
    setActiveTab("calendars");
  }, [dashboard, searchParams]);

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

  // Pending concierge menu (the owner's "choose this month's event" card).
  // Only relevant on concierge calendars; refetched after a selection so the
  // card disappears once the pick is locked and the event is published.
  const [pendingMenu, setPendingMenu] = useState<ConciergeMenu | null>(null);
  const loadPendingMenu = useCallback(async () => {
    if (!dashboard || dashboard.tier !== "concierge") {
      setPendingMenu(null);
      return;
    }
    try {
      const r: { menu: ConciergeMenu | null } = await Parse.Cloud.run(
        "getPendingConciergeMenu",
        { calendarId }
      );
      setPendingMenu(r.menu);
    } catch (err) {
      console.warn("[Concierge] pending menu load failed:", err);
      setPendingMenu(null);
    }
  }, [dashboard, calendarId]);

  useEffect(() => {
    loadPendingMenu();
  }, [loadPendingMenu]);

  // Unread concierge messages — badges the serviced calendar in the list. The
  // inline thread marks messages read server-side, so the next poll clears it.
  const [conciergeUnread, setConciergeUnread] = useState(0);
  useEffect(() => {
    if (!dashboard || dashboard.tier !== "concierge") {
      setConciergeUnread(0);
      return;
    }
    let alive = true;
    const tick = () =>
      Parse.Cloud.run("getConciergeUnread", { calendarId })
        .then((r: { unread: number }) => {
          if (alive) setConciergeUnread(r?.unread || 0);
        })
        .catch(() => {});
    tick();
    const t = setInterval(tick, 20000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [dashboard, calendarId]);

  // Selected calendar in the Calendars tab's master/detail layout.
  const [calendarsSelectedId, setCalendarsSelectedId] = useState<string | null>(null);

  // Change which calendar the concierge serves (no cancel needed — it's a
  // pointer on the org). Refetches so the highlight + Messages move over.
  const [settingServicedId, setSettingServicedId] = useState<string | null>(null);
  const setServicedCalendar = async (targetCalendarId: string) => {
    setSettingServicedId(targetCalendarId);
    try {
      await Parse.Cloud.run("setConciergeServicedCalendar", {
        orgId: calendarId,
        calendarId: targetCalendarId,
      });
      await fetchDashboard();
    } catch (err) {
      console.warn("[Concierge] set serviced calendar failed:", err);
    } finally {
      setSettingServicedId(null);
    }
  };

  // Analytics fetcher — Pro tier only
  const fetchAnalytics = useCallback(
    async (range: "7d" | "30d" | "90d" | "all", calFilter?: string) => {
      if (!dashboard || !PAID_TIERS.includes(dashboard.tier)) return;
      setAnalyticsLoading(true);
      setAnalyticsError(null);
      try {
        const filterCal = calFilter ?? analyticsCalFilter;
        const result = await Parse.Cloud.run("getOrgAnalytics", {
          calendarId,
          range,
          ...(filterCal !== "all" ? { filterCalendarId: filterCal } : {}),
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
    [calendarId, dashboard, analyticsCalFilter]
  );

  // Auto-load analytics when the tab opens, range changes, or calendar filter changes
  useEffect(() => {
    if (activeTab === "analytics" && dashboard && PAID_TIERS.includes(dashboard.tier)) {
      fetchAnalytics(analyticsRange);
    }
  }, [activeTab, analyticsRange, analyticsCalFilter, dashboard, fetchAnalytics]);

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

  async function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { preview, base64 } = await processImageFile(file);
      setSettingsLogoPreview(preview);
      setSettingsLogoBase64(base64);
    } catch {
      alert("Could not process this image. Please try a different file.");
    }
  }

  async function handleAddCalendar() {
    if (!newCalName || !newCalCity || !newCalCitySelected) return;
    setAddingCalendar(true);
    try {
      const params: Record<string, string | number | boolean> = {
        organizationId: calendarId,
        name: newCalName,
        description: newCalDesc,
        city: newCalCity,
      };
      if (newCalLat != null && newCalLng != null) {
        params.lat = newCalLat;
        params.lng = newCalLng;
      }
      if (newCalHideDeals) params.hideDeals = true;
      await Parse.Cloud.run("createCalendarUnderOrg", params);
      setShowAddCalendar(false);
      setNewCalName("");
      setNewCalDesc("");
      setNewCalCity("");
      setNewCalCitySelected(false);
      setNewCalLat(null);
      setNewCalLng(null);
      setNewCalHideDeals(false);
      fetchDashboard();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add calendar";
      alert(message);
    } finally {
      setAddingCalendar(false);
    }
  }

  async function handleSubscriptionChange(tier: string, billingPeriod: "monthly" | "yearly" = "monthly") {
    setSubscriptionLoading(true);
    try {
      if (tier === "starter") {
        // Downgrade to free — schedule Stripe cancel-at-period-end
        if (!confirm("Switching to Free will cancel your subscription at the end of the current billing period. Continue?")) {
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
          billingPeriod,
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
    if (!confirm("Are you sure you want to cancel your subscription? You will be downgraded to the Free plan at the end of your current billing period.")) return;
    setSubscriptionLoading(true);
    try {
      const result = await Parse.Cloud.run("cancelOrgSubscription", { calendarId });
      if (result.cancelAt) setCancelAt(result.cancelAt);
      fetchDashboard();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to cancel";
      alert(message);
    } finally {
      setSubscriptionLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await Parse.User.logOut();
    } catch {
      // ignore
    }
    // Drop the cached dashboard so the next (possibly different) user never
    // flashes this owner's data before their own load completes.
    try { localStorage.removeItem(dashboardCacheKey); } catch { /* ignore */ }
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
    // Force a real choice: "all" or at least one calendar selected.
    if (!inviteScopeAll && inviteScopeIds.length === 0) {
      alert("Pick at least one calendar, or choose All Calendars.");
      return;
    }
    setInviting(true);
    setInviteSuccess("");
    try {
      await Parse.Cloud.run("inviteCoHost", {
        calendarId,
        email: inviteEmail,
        name: inviteName,
        ...(inviteScopeAll ? {} : { calendarIds: inviteScopeIds }),
      });
      setInviteSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setInviteName("");
      setInviteScopeAll(true);
      setInviteScopeIds([]);
      fetchDashboard();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send invite";
      alert(message);
    } finally {
      setInviting(false);
    }
  }

  async function handleSaveScope() {
    if (!editScopeFor) return;
    if (!editScopeAll && editScopeIds.length === 0) {
      alert("Pick at least one calendar, or choose All Calendars.");
      return;
    }
    setSavingScope(true);
    try {
      await Parse.Cloud.run("setCoHostScope", {
        orgId: calendarId,
        ...(editScopeFor.userId ? { userId: editScopeFor.userId } : { email: editScopeFor.email }),
        allCalendars: editScopeAll,
        calendarIds: editScopeAll ? [] : editScopeIds,
      });
      setEditScopeFor(null);
      await fetchDashboard();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update scope";
      alert(message);
    } finally {
      setSavingScope(false);
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

  // `growth` is the retired Social tier — existing subscribers still carry it
  // in the DB until the server-side migration runs, so treat them as Pro.
  const isPaid = PAID_TIERS.includes(dashboard.tier);
  const tierLabel = dashboard.tier === "concierge" ? "Concierge" : isPaid ? "Pro" : "Free";

  // ── Render ──

  return (
    <div className="min-h-screen bg-white">
      {/* Concierge state banner (renders only when relevant) */}
      <ConciergeDashboardBanner calendarId={calendarId} />

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
                (tab.proOnly && !isPaid) ||
                ((tab as { paidOnly?: boolean }).paidOnly && !isPaid);
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

      {/* Pending business-event requests — thin banner, jumps to the
          primary calendar's edit page (where approvals now live). */}
      {dashboard.isOwner && eventApprovals.length > 0 && (
        <div className="max-w-5xl mx-auto px-6 pt-4">
          <Link
            href={`/dashboard/${calendarId}/calendars/${calendarId}/edit`}
            className="w-full flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-left hover:bg-amber-100/70 transition-colors"
          >
            <span className="text-sm text-amber-900">
              <span className="font-semibold">{eventApprovals.length}</span>{" "}
              business event{" "}
              {eventApprovals.length === 1 ? "request" : "requests"} awaiting your
              review
            </span>
            <span className="text-xs font-semibold text-amber-800 shrink-0">
              Review →
            </span>
          </Link>
        </div>
      )}

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
                          className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            const d = req.requestedDate ? new Date(req.requestedDate) : null;
                            const pad = (n: number) => String(n).padStart(2, "0");
                            setCreatePlanPrefill({
                              title: req.title,
                              description: req.description || "",
                              venue: req.requestedVenue ? { name: req.requestedVenue.name, address: req.requestedVenue.address, placeId: req.requestedVenue.placeId ?? null } : null,
                              date: d ? `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` : "",
                              time: d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "",
                              capacity: req.requestedCapacity != null ? String(req.requestedCapacity) : "",
                              imageUrl: req.image || null,
                              requireApproval: req.requestedRequireApproval,
                            });
                            setEditingHostRequestId(req.planId);
                            setEditingHostRequestCalendarId(req.calendarId);
                            setShowCreatePlanModal(true);
                          }}
                          className="px-3 py-1.5 bg-white text-zinc-700 text-xs font-bold uppercase tracking-widest rounded-lg border border-zinc-300 hover:bg-zinc-50 transition-colors"
                        >
                          Edit
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
                          className="px-3 py-1.5 bg-white text-zinc-600 text-xs font-bold uppercase tracking-widest rounded-lg border border-zinc-300 hover:bg-zinc-50 transition-colors"
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
                          className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-emerald-700 transition-colors"
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
                          className="px-3 py-1.5 bg-white text-zinc-600 text-xs font-bold uppercase tracking-widest rounded-lg border border-zinc-300 hover:bg-zinc-50 transition-colors"
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
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Name</label>
                    <input
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      className="w-full border-b border-zinc-300 py-2 text-lg font-light focus:outline-none focus:border-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Description</label>
                    <textarea
                      value={descValue}
                      onChange={(e) => setDescValue(e.target.value)}
                      rows={3}
                      className="w-full border border-zinc-200 rounded-lg p-3 text-sm font-light focus:outline-none focus:border-zinc-400 resize-none"
                    />
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
                {
                  label: dashboard.rsvpLimit ? "RSVPs (this mo.)" : "Plan RSVPs",
                  value: dashboard.rsvpLimit
                    ? `${dashboard.rsvpsThisMonth}/${dashboard.rsvpLimit}`
                    : dashboard.totalRsvpCount,
                },
                { label: "Active Plans", value: dashboard.upcomingPlanCount },
              ].map((stat) => (
                <div key={stat.label} className="border border-zinc-200 rounded-xl p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1">{stat.label}</p>
                  <p className="text-2xl font-light">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Upcoming plans across all calendars */}
            {(() => {
              const upcoming = dashboard.calendars
                .flatMap((c) => ((c as Record<string, unknown>).activePlans as CalActivePlan[]) || [])
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
              if (upcoming.length === 0) return null;
              return (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Upcoming Plans</h3>
                    <button
                      onClick={() => setActiveTab("calendars")}
                      className="text-xs uppercase tracking-widest font-bold text-zinc-400 hover:text-zinc-900 transition-colors"
                    >
                      See all
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {upcoming.slice(0, 8).map((plan) => (
                      <button
                        key={plan.objectId}
                        type="button"
                        onClick={() => setSelectedActivePlan(plan)}
                        className="text-left border border-zinc-100 rounded-lg overflow-hidden hover:border-zinc-200 transition-colors"
                      >
                        {plan.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={plan.image} alt={plan.title} className="w-full h-28 object-cover" />
                        ) : (
                          <div className="w-full h-28 bg-zinc-100 flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-zinc-300" />
                          </div>
                        )}
                        <div className="p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            {plan.isPoll && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-widest px-1 py-0.5 rounded bg-zinc-900 text-white shrink-0">
                                <Vote className="w-2.5 h-2.5" /> Poll
                              </span>
                            )}
                            <h4 className="font-medium text-sm truncate">{plan.title}</h4>
                          </div>
                          <p className="text-xs text-zinc-400 mb-1">
                            {new Date(plan.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                          </p>
                          <div className="flex items-center justify-between text-xs text-zinc-400">
                            <span className="truncate">{plan.hostName}</span>
                            <span className="shrink-0 ml-2">
                              {plan.isPoll ? `${plan.pollVoteCount ?? 0} votes` : `${plan.rsvpCount} RSVPs`}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })()}

            {dashboard.rsvpLimit !== null && dashboard.rsvpsThisMonth >= 40 && (
              <div className={`border rounded-xl p-4 flex items-start gap-3 ${
                dashboard.rsvpsThisMonth >= dashboard.rsvpLimit
                  ? "border-red-200 bg-red-50"
                  : "border-amber-200 bg-amber-50"
              }`}>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    dashboard.rsvpsThisMonth >= dashboard.rsvpLimit ? "text-red-900" : "text-amber-900"
                  }`}>
                    {dashboard.rsvpsThisMonth >= dashboard.rsvpLimit
                      ? "You've hit this month's RSVP limit."
                      : "You're near this month's RSVP limit."}
                  </p>
                  <p className={`text-xs mt-0.5 ${
                    dashboard.rsvpsThisMonth >= dashboard.rsvpLimit ? "text-red-700" : "text-amber-700"
                  }`}>
                    {dashboard.rsvpsThisMonth}/{dashboard.rsvpLimit} RSVPs used. Upgrade to Pro for unlimited — resets on the 1st.
                  </p>
                </div>
                <button
                  onClick={() => setShowSubscription(true)}
                  className="bg-zinc-900 text-white px-3 py-1.5 text-xs font-semibold rounded-full hover:bg-zinc-800 transition-colors shrink-0"
                >
                  Upgrade
                </button>
              </div>
            )}

            {/* Recent Photos — attendee uploads from past plans */}
            {dashboard.recentPhotos && dashboard.recentPhotos.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                    Recent Photos
                  </h3>
                  <button
                    onClick={() => { setActiveTab("calendars"); setCalendarsSelectedId(calendarId); setManagePlansCalId(calendarId); }}
                    className="text-xs uppercase tracking-widest font-bold text-zinc-400 hover:text-zinc-900 transition-colors"
                  >
                    See all
                  </button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 [&>*:nth-child(n+4)]:hidden sm:[&>*:nth-child(-n+4)]:block sm:[&>*:nth-child(n+5)]:hidden md:[&>*:nth-child(-n+6)]:block md:[&>*:nth-child(n+7)]:hidden">
                  {dashboard.recentPhotos.slice(0, 6).map((photo) =>
                    photo.url ? (
                      <a
                        key={photo.objectId}
                        href={photo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`${photo.eventTitle} · ${photo.uploaderName}`}
                        className="block aspect-square rounded-lg overflow-hidden bg-zinc-100 group relative"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.url}
                          alt={`Photo from ${photo.eventTitle}`}
                          className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                        />
                      </a>
                    ) : null
                  )}
                </div>
              </section>
            )}

            {/* Concierge menu — owner picks this month's event; selecting it
                publishes the plan to the calendar. Only present on concierge
                calendars with a menu awaiting selection. */}
            {pendingMenu && (
              <ConciergeMenuCard
                menu={pendingMenu}
                onSelected={() => {
                  loadPendingMenu();
                  fetchDashboard();
                }}
              />
            )}

            {/* Concierge post-event reports — attendee feedback + recaps. */}
            {dashboard.tier === "concierge" && (
              <ConciergeEventReports calendarId={calendarId} />
            )}

            {/* Concierge upsell — hidden once the calendar is already on the
                Concierge tier (server reverts tier on cancellation, so this
                also re-appears if they churn). */}
            {dashboard.tier !== "concierge" && (
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-xl shadow-black/40">
                {/* Layered ambient background — dark base + an emerald glow
                    bleeding from the top-right, a faint cool glow bottom-left
                    for depth, and a hairline sheen along the top edge. */}
                <div aria-hidden className="pointer-events-none absolute inset-0">
                  <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black" />
                  {/* Full-bleed photo behind the whole card, darkened so the
                      copy layered on top stays legible. */}
                  <div className="absolute inset-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="https://images.unsplash.com/photo-1545315003-c5ad6226c272?w=1600&q=70&auto=format&fit=crop"
                      alt=""
                      className="h-full w-full object-cover object-[center_30%] opacity-60"
                    />
                    {/* Even dark scrim so the copy reads across the full width. */}
                    <div className="absolute inset-0 bg-zinc-950/70" />
                    <div className="absolute inset-0 bg-black/40" />
                  </div>
                  <div className="absolute -top-24 -right-16 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
                  <div className="absolute -bottom-24 -left-12 h-56 w-56 rounded-full bg-sky-500/10 blur-3xl" />
                  {/* Fine film-grain texture for an editorial, tactile finish. */}
                  <div
                    className="absolute inset-0 opacity-[0.18] mix-blend-overlay"
                    style={{
                      backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
                    }}
                  />
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                </div>

                <div className="relative">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h3 className="text-lg font-semibold tracking-tight text-white">We&apos;ll run your events for you</h3>
                    <span className="shrink-0 bg-emerald-500 text-black text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full">New</span>
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                    Don&apos;t have time to plan, post, and show up? Bring on a dedicated host to run your calendar and host plans on behalf of your community. From $499/mo.
                  </p>
                  <ul className="space-y-2 mb-5 list-disc list-inside marker:text-emerald-500/60">
                    <li className="text-xs text-zinc-400 leading-relaxed"><strong className="text-zinc-100">Plans posted for you</strong> — your host drafts, schedules, and publishes plans to your calendar on a steady cadence.</li>
                    <li className="text-xs text-zinc-400 leading-relaxed"><strong className="text-zinc-100">Hosted on your behalf</strong> — a real person shows up, greets attendees, and represents your community at every gathering.</li>
                    <li className="text-xs text-zinc-400 leading-relaxed"><strong className="text-zinc-100">RSVP &amp; chat management</strong> — from approvals to day-of reminders, your host handles the back-and-forth so you don&apos;t have to.</li>
                  </ul>
                  <a href="https://calendar.app.google/NCUYc6LUKSiwLUa67" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors">
                    Book a demo
                  </a>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ──────── ANALYTICS TAB ──────── */}
        {activeTab === "analytics" && PAID_TIERS.includes(dashboard.tier) && (
          <div className="space-y-8">
            {/* Range selector + calendar filter */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
                  Analytics
                </h2>
                {dashboard.calendars.length > 1 && (
                  <select
                    value={analyticsCalFilter}
                    onChange={(e) => setAnalyticsCalFilter(e.target.value)}
                    className="text-xs border border-zinc-200 rounded-lg px-3 py-2 text-zinc-600 focus:outline-none focus:border-zinc-400"
                  >
                    <option value="all">All Calendars</option>
                    {dashboard.calendars.filter((c) => c.isActive).map((cal) => (
                      <option key={cal.objectId} value={cal.objectId}>{cal.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex gap-1 border border-zinc-200 rounded-lg p-0.5">
                {(["7d", "30d", "90d", "all"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setAnalyticsRange(r)}
                    className={`px-3 py-1.5 text-xs uppercase tracking-widest font-bold rounded-md transition-colors ${
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
                  // Build a stable dismiss key from insight content. If the
                  // underlying insight changes (e.g., top category flips from
                  // "dining" to "music"), the key changes and the new one
                  // appears even if the prior was dismissed.
                  const insightKey = (ins: { type: string; message: string }) =>
                    `${ins.type}|${ins.message}`.slice(0, 200);

                  const filtered = analytics.insights
                    .filter((ins) => ins.type !== "no_growth")
                    .filter((ins) => !dismissedInsights.has(insightKey(ins)));
                  if (filtered.length === 0) return null;
                  return (
                    <section className="space-y-2">
                      {filtered.map((ins) => {
                        const key = insightKey(ins);
                        return (
                          <div
                            key={key}
                            className="border border-emerald-200 bg-emerald-50/40 rounded-lg px-3 py-2 flex items-center gap-3"
                          >
                            <div className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center flex-shrink-0">
                              <Sparkles className="w-3 h-3" />
                            </div>
                            <p className="text-xs text-zinc-700 leading-snug flex-1">
                              {ins.message}
                            </p>
                            <button
                              onClick={() => dismissInsight(key)}
                              className="text-xs uppercase tracking-widest font-bold text-zinc-400 hover:text-zinc-700 transition-colors flex-shrink-0"
                            >
                              Dismiss
                            </button>
                          </div>
                        );
                      })}
                    </section>
                  );
                })()}

                {/* Growth headline stats */}
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">
                    Growth
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                      {
                        label: "Page Views",
                        value: analytics.growth.pageViewCount,
                        delta: analytics.growth.pageViewsInRange,
                        deltaPct: analytics.growth.pageViewDeltaPct,
                      },
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
                        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1">
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
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">
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

                {/* Page views over time */}
                <section className="border border-zinc-200 rounded-xl p-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">
                    Page views over time
                  </h3>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.growth.pageViewSeries}>
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
                        <Bar dataKey="value" fill="#18181b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                {/* RSVPs by day of week + time of day */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <section className="border border-zinc-200 rounded-xl p-6">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">
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
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">
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
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">
                    Engagement
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-zinc-400 mb-1">
                        Avg RSVPs / plan
                      </p>
                      <p className="text-2xl font-light">{analytics.engagement.rsvpRate}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest text-zinc-400 mb-1">
                        Attendance
                      </p>
                      <p className="text-2xl font-light">
                        {analytics.engagement.attendanceRate}%
                        <span className="text-sm text-zinc-400 ml-1">
                          ({analytics.engagement.attendanceCount}/{analytics.engagement.rsvpCount})
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest text-zinc-400 mb-1">
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
                      <p className="text-xs uppercase tracking-widest text-zinc-400 mb-1">
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
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">
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
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">
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

        {/* ──────── CALENDARS TAB (3-panel: list · concierge chat · plans) ──────── */}
        {activeTab === "calendars" && (() => {
          const cals = dashboard.calendars;
          const selectedCal =
            cals.find((c) => c.objectId === calendarsSelectedId) ||
            cals.find((c) => c.isConciergeServiced) ||
            cals.find((c) => c.isPrimary) ||
            cals[0];
          return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
                Calendars ({dashboard.calendars.length}{dashboard.calendarLimit ? `/${dashboard.calendarLimit}` : ""})
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 items-start lg:grid-cols-[260px_minmax(0,1fr)]">
              {selectedCal && (() => {
                const cal = selectedCal;
                const inactive = cal.isActive === false;
                const listPanel = (
                  <div className="border border-zinc-200 rounded-xl divide-y divide-zinc-100 overflow-hidden">
                    {cals.map((c) => {
                      const isSel = selectedCal?.objectId === c.objectId;
                      const off = c.isActive === false;
                      return (
                        <button
                          key={c.objectId}
                          onClick={() => setCalendarsSelectedId(c.objectId)}
                          className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors hover:bg-zinc-50 focus:outline-none ${isSel ? "bg-zinc-50" : ""} ${off ? "opacity-60" : ""}`}
                        >
                          {c.calendarImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.calendarImage} alt={c.name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                              <Calendar className="w-4 h-4 text-zinc-300" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-zinc-900 truncate">{c.name}</span>
                            </div>
                            <div className="text-[11px] text-zinc-400 truncate">
                              {c.isPrimary ? "Primary · " : ""}{c.city || "No city set"}
                            </div>
                          </div>
                          {c.isConciergeServiced && conciergeUnread > 0 ? (
                            <span className="bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none min-w-[16px] text-center shrink-0">
                              {conciergeUnread}
                            </span>
                          ) : isSel ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 shrink-0" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                );
                return (
                  <>
                  {/* LEFT — calendar list + add-calendar */}
                  <div className="space-y-3 min-w-0">
                    {listPanel}
                    {isPaid && (
                      <button
                        onClick={() => {
                          if (dashboard.calendarLimit && dashboard.calendars.length >= dashboard.calendarLimit) {
                            setShowSubscription(true);
                          } else {
                            setShowAddCalendar(true);
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 border border-dashed border-zinc-300 text-zinc-500 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest hover:border-zinc-400 hover:text-zinc-900 transition-colors"
                      >
                        {dashboard.calendarLimit && dashboard.calendars.length >= dashboard.calendarLimit ? (
                          <><Lock className="w-3.5 h-3.5" /> Upgrade to Add</>
                        ) : (
                          <><Plus className="w-3.5 h-3.5" /> Add Calendar</>
                        )}
                      </button>
                    )}
                  </div>
                  {/* RIGHT — header + plans (or the Manage Plans surface) */}
                  <div className="space-y-4 min-w-0">
                    <div
                      className={`border rounded-xl px-4 py-3 ${
                        inactive ? "border-zinc-100 bg-zinc-50 opacity-70" : "border-zinc-200"
                      }`}
                    >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {cal.calendarImage ? (
                          <img src={cal.calendarImage} alt={cal.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                            <Calendar className="w-5 h-5 text-zinc-300" />
                          </div>
                        )}
                        <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
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
                              <Link
                                href={`/org/${cal.shareId}/promote?org=${calendarId}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-zinc-300 hover:text-emerald-600 transition-colors"
                                title="Promote — print flyers and door hangers"
                              >
                                <Megaphone className="w-4 h-4" />
                              </Link>
                            </>
                          )}
                          {cal.isPrimary && (
                            <span className="text-xs font-bold uppercase tracking-widest bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full">
                              Primary
                            </span>
                          )}
                          {cal.role === "Host" && (
                            <span className="text-xs font-bold uppercase tracking-widest bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                              Co-host
                            </span>
                          )}
                          {inactive && (
                            <span className="text-xs font-bold uppercase tracking-widest bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400">{cal.city || "No city set"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 pl-[52px] sm:pl-0">
                        {inactive ? (
                          <button
                            onClick={() => setShowSubscription(true)}
                            className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors"
                          >
                            <Lock className="w-3.5 h-3.5" /> Upgrade to Reactivate
                          </button>
                        ) : (
                          <>
                            {cal.isConciergeServiced && (
                              <button
                                onClick={() => setShowConciergeChat(true)}
                                title="Concierge"
                                className="relative text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1 transition-colors"
                              >
                                <MessageCircle className="w-4 h-4" />
                                <span>Concierge</span>
                                {conciergeUnread > 0 && (
                                  <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none min-w-[16px] text-center">
                                    {conciergeUnread}
                                  </span>
                                )}
                              </button>
                            )}
                            {dashboard.tier === "concierge" && !cal.isConciergeServiced && (
                              <button
                                onClick={() => setServicedCalendar(cal.objectId)}
                                disabled={settingServicedId === cal.objectId}
                                title="Make this the calendar your concierge runs"
                                className="text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1 disabled:opacity-50"
                              >
                                <Sparkles className="w-3 h-3 text-emerald-500" />
                                {settingServicedId === cal.objectId ? "Setting…" : "Make concierge"}
                              </button>
                            )}
                            <Link
                              href={`/dashboard/${calendarId}/calendars/${cal.objectId}/edit`}
                              className="text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1"
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                    </div>
                    {embedCalId === cal.objectId && (
                      <div className="border border-zinc-200 rounded-xl p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Embed on Your Website</p>
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
                            className="absolute top-2 right-2 text-xs bg-zinc-900 text-white px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors font-bold uppercase tracking-widest"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="pt-2">
                      <PlansManager
                        calendarId={cal.objectId}
                        orgId={calendarId}
                        initialPrefill={managePlansCalId === cal.objectId ? managePlansPrefill : null}
                        returnTo={managePlansCalId === cal.objectId ? managePlansReturnTo : null}
                      />
                    </div>
                  </div>
                  </>
                );
              })()}
            </div>
          </div>
          );
        })()}


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
                coverSeed: event.id,
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

            {/* Organization Logo — open to all users */}
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
                      accept={IMAGE_ACCEPT}
                      onChange={handleLogoSelect}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-zinc-400 mt-2">Square image recommended. Visible on your public calendar page.</p>
                </div>
              </div>
            </section>

            {/* Brand Color — open to all users */}
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

            {/* AI Idea Generation */}
            <div className="relative">
              {!isPaid && (
                <div className="absolute top-4 right-4 z-10" onClick={() => setShowSubscription(true)}>
                  <div className="flex items-center gap-2 bg-zinc-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest cursor-pointer hover:bg-zinc-800 transition-colors">
                    <Lock className="w-3 h-3" /> Upgrade
                  </div>
                </div>
              )}
              <section className={`border border-zinc-200 rounded-xl p-6 space-y-8 ${!isPaid ? "opacity-40 pointer-events-none" : ""}`}>
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

            {/* Delete organization — single terminal action. Cascade-deletes
                this organization AND the underlying account in one step. For
                a non-org (personal) user the same destination page reads
                "Delete account" — same flow, contextual label. */}
            <section className="border border-zinc-200 rounded-xl p-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4">Delete organization</h2>
              <a
                href={`/account/delete?from=${calendarId}`}
                className="text-sm text-red-600 hover:text-red-700 underline font-medium"
              >
                Delete organization
              </a>
              <p className="text-xs text-zinc-500 mt-2">
                Permanently removes this organization, its calendar, and your
                sign-in. Followers and past plans are erased.
              </p>
            </section>
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
                    ? dashboard.billingInterval === "year" ? "$49.99/year — legacy Social plan, grandfathered into Pro features" : "$4.99/month — legacy Social plan, grandfathered into Pro features"
                    : dashboard.billingInterval === "year" ? "$99/year — full features" : "$9.99/month — full features"}
                </p>
                {dashboard.subscriptionStatus === "cancelling" && (
                  <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                    <p className="text-sm font-medium text-amber-800">Subscription cancelling</p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Your plan remains active until {(cancelAt || dashboard.subscriptionCancelAt) ? new Date((cancelAt || dashboard.subscriptionCancelAt!) * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "the end of your billing period"}. After that, you&apos;ll be downgraded to the Free plan.
                    </p>
                  </div>
                )}
              </section>

              <button
                onClick={() => setShowSubscription(true)}
                className="bg-zinc-900 text-white px-6 py-3 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors"
              >
                {dashboard.tier === "starter" ? "Upgrade Plan" : "Change Plan"}
              </button>

              {dashboard.tier !== "starter" && dashboard.subscriptionStatus !== "cancelling" && (
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
                <div className="flex-1 min-w-0">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Email</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full border-b border-zinc-300 py-2 text-sm font-light focus:outline-none focus:border-zinc-900"
                    placeholder="cohost@example.com"
                  />
                </div>
                <div className="w-56 relative">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Calendars</label>
                  <button
                    type="button"
                    onClick={() => setInviteScopeOpen((o) => !o)}
                    className="w-full border-b border-zinc-300 py-2 text-sm font-light focus:outline-none focus:border-zinc-900 text-left flex items-center justify-between gap-2"
                  >
                    <span className="truncate">
                      {inviteScopeAll
                        ? "All Calendars"
                        : inviteScopeIds.length === 0
                        ? "Select calendars…"
                        : inviteScopeIds.length === 1
                        ? dashboard.calendars.find((c) => c.objectId === inviteScopeIds[0])?.name || "1 calendar"
                        : `${inviteScopeIds.length} calendars`}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform ${inviteScopeOpen ? "rotate-180" : ""}`} />
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
                          onClick={() => { setInviteScopeAll(true); setInviteScopeIds([]); }}
                          className={`w-full px-3 py-2 text-sm text-left hover:bg-zinc-50 flex items-center gap-2 border-b border-zinc-100 ${inviteScopeAll ? "text-zinc-900 font-medium" : "text-zinc-600"}`}
                        >
                          <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${inviteScopeAll ? "bg-zinc-900 border-zinc-900" : "border-zinc-300"}`}>
                            {inviteScopeAll && <Check className="w-3 h-3 text-white" />}
                          </span>
                          All Calendars
                        </button>
                        {dashboard.calendars.map((cal) => {
                          const selected = !inviteScopeAll && inviteScopeIds.includes(cal.objectId);
                          return (
                            <button
                              key={cal.objectId}
                              type="button"
                              onClick={() => {
                                setInviteScopeAll(false);
                                setInviteScopeIds((prev) =>
                                  prev.includes(cal.objectId)
                                    ? prev.filter((id) => id !== cal.objectId)
                                    : [...prev, cal.objectId]
                                );
                              }}
                              className={`w-full px-3 py-2 text-sm text-left hover:bg-zinc-50 flex items-center gap-2 ${selected ? "text-zinc-900 font-medium" : "text-zinc-600"}`}
                            >
                              <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected ? "bg-zinc-900 border-zinc-900" : "border-zinc-300"}`}>
                                {selected && <Check className="w-3 h-3 text-white" />}
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
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Name (optional)</label>
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
                  disabled={!inviteEmail || inviting || (!inviteScopeAll && inviteScopeIds.length === 0)}
                  className="bg-zinc-900 text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors disabled:opacity-50 shrink-0"
                >
                  {inviting ? "Sending..." : "Send Invite"}
                </button>
              </div>
              <p className="text-xs text-zinc-400 mt-2">
                {inviteScopeAll
                  ? "Co-host will have access to every current and future calendar in this organization."
                  : `Co-host will have access only to ${inviteScopeIds.length === 0 ? "the calendars you select" : `${inviteScopeIds.length} selected calendar${inviteScopeIds.length === 1 ? "" : "s"}`}.`}
              </p>
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
                        <th className="text-left px-4 py-3 font-bold">Calendar</th>
                        <th className="text-left px-4 py-3 font-bold">Joined</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {dashboard.members.map((m, i) => {
                        const isHost = m.status === "Host";
                        const isOwnerRow = m.status === "Owned" || m.status === "Owner";
                        return (
                          <tr key={m.membershipId || `${m.objectId || m.email}-${i}`}>
                            <td className="px-4 py-3">{m.name}</td>
                            <td className="px-4 py-3 text-zinc-400">{m.email || "—"}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs bg-zinc-100 px-2 py-0.5 rounded-full">
                                  {isOwnerRow ? "Owner" : m.status}
                                </span>
                                {m.pending && (
                                  <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                                    Pending invite
                                  </span>
                                )}
                                {m.leafAppConnected && (
                                  <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                                    Synced to app
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-zinc-500">
                              {isOwnerRow ? (
                                <span className="text-xs text-zinc-400">All Calendars</span>
                              ) : isHost && m.scope ? (
                                m.scope.allCalendars ? (
                                  <span className="text-xs">All Calendars</span>
                                ) : m.scope.calendars.length === 0 ? (
                                  <span className="text-xs text-zinc-400">—</span>
                                ) : (
                                  <span
                                    className="text-xs"
                                    title={m.scope.calendars.map((c) => c.name).join(", ")}
                                  >
                                    {m.scope.calendars.length === 1
                                      ? m.scope.calendars[0].name
                                      : `${m.scope.calendars.length} calendars`}
                                  </span>
                                )
                              ) : (
                                <span className="text-xs text-zinc-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-zinc-400">
                              {new Date(m.joinedAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {isHost && (
                                  <button
                                    onClick={() => {
                                      const all = m.scope?.allCalendars ?? true;
                                      const ids = m.scope?.calendars.map((c) => c.id) ?? [];
                                      setEditScopeFor({
                                        name: m.name,
                                        userId: m.objectId,
                                        email: m.email,
                                      });
                                      setEditScopeAll(all);
                                      setEditScopeIds(all ? [] : ids);
                                    }}
                                    className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 transition-colors"
                                    title="Edit scope"
                                  >
                                    Edit
                                  </button>
                                )}
                                {!isOwnerRow && (
                                  <button
                                    onClick={async () => {
                                      if (!confirm(`Remove ${m.name} from this calendar?`)) return;
                                      try {
                                        if (isHost) {
                                          await Parse.Cloud.run("removeCoHost", {
                                            orgId: calendarId,
                                            ...(m.objectId ? { userId: m.objectId } : { email: m.email }),
                                          });
                                        } else if (m.membershipId) {
                                          await Parse.Cloud.run("removeMember", {
                                            membershipId: m.membershipId,
                                            calendarId,
                                          });
                                        }
                                        fetchDashboard();
                                      } catch (err) {
                                        console.error("Failed to remove member:", err);
                                        alert(err instanceof Error ? err.message : "Failed to remove user.");
                                      }
                                    }}
                                    className="text-zinc-400 hover:text-red-500 transition-colors"
                                    title="Remove user"
                                  >
                                    <UserMinus className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
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
                              className="bg-zinc-900 text-white px-3 py-1.5 text-xs uppercase tracking-wider font-bold rounded-lg hover:bg-zinc-800 transition-colors"
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
                              className="text-zinc-300 hover:text-red-500 transition-colors text-xs uppercase tracking-wider font-bold px-3 py-1.5 border border-zinc-200 rounded-lg hover:border-red-200"
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
                            className="bg-zinc-900 text-white px-4 py-2 text-xs uppercase tracking-wider font-bold rounded-lg hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </a>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`os.joinleaf.com/org/${cal.shareId}`);
                              setToast("Link copied!");
                              setTimeout(() => setToast(null), 2000);
                            }}
                            className="border border-zinc-200 px-4 py-2 text-xs uppercase tracking-wider font-bold rounded-lg hover:bg-white transition-colors flex items-center gap-1.5"
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
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Name</label>
                <input
                  value={newCalName}
                  onChange={(e) => setNewCalName(e.target.value)}
                  className="w-full border-b border-zinc-300 py-2 text-lg font-light focus:outline-none focus:border-zinc-900"
                  placeholder="Calendar name"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Description</label>
                <textarea
                  value={newCalDesc}
                  onChange={(e) => setNewCalDesc(e.target.value)}
                  rows={2}
                  className="w-full border border-zinc-200 rounded-lg p-3 text-sm font-light focus:outline-none focus:border-zinc-400 resize-y"
                  placeholder="What is this calendar about?"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">
                  Location
                </label>
                <CityAutocomplete
                  value={newCalCity}
                  onChange={(v) => { setNewCalCity(v); setNewCalCitySelected(false); setNewCalLat(null); setNewCalLng(null); }}
                  onSelect={(place) => {
                    setNewCalCity(place.description);
                    setNewCalCitySelected(true);
                    if (place.lat != null && place.lng != null) {
                      setNewCalLat(place.lat);
                      setNewCalLng(place.lng);
                    }
                  }}
                  placeholder="City, neighborhood, or building address"
                  className="w-full border-b border-zinc-300 py-2 text-lg font-light focus:outline-none focus:border-zinc-900"
                />
                <p className="text-[11px] text-zinc-400 mt-1">
                  More specific = more accurate nearby-deal matching.
                </p>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-xs font-medium text-zinc-700">Show local deals</p>
                  <p className="text-xs text-zinc-400">Surface a strip of deals from nearby businesses</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNewCalHideDeals(!newCalHideDeals)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${!newCalHideDeals ? "bg-zinc-900" : "bg-zinc-200"}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${!newCalHideDeals ? "left-5" : "left-0.5"}`} />
                </button>
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


      {/* Edit Co-Host Scope Modal */}
      {editScopeFor && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-xl p-8 relative">
            <button
              onClick={() => setEditScopeFor(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-zinc-100"
            >
              <Plus className="w-5 h-5 rotate-45" />
            </button>
            <h2 className="text-xl font-light tracking-tight mb-1">Edit co-host scope</h2>
            <p className="text-xs text-zinc-500 mb-6">
              {editScopeFor.name}
            </p>
            <div className="mb-6">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-2">Calendars</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { setEditScopeAll(true); setEditScopeIds([]); }}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    editScopeAll
                      ? "bg-zinc-900 text-white border-zinc-900"
                      : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  All Calendars
                </button>
                {dashboard.calendars.map((cal) => {
                  const selected = !editScopeAll && editScopeIds.includes(cal.objectId);
                  return (
                    <button
                      key={cal.objectId}
                      type="button"
                      onClick={() => {
                        setEditScopeAll(false);
                        setEditScopeIds((prev) =>
                          prev.includes(cal.objectId)
                            ? prev.filter((id) => id !== cal.objectId)
                            : [...prev, cal.objectId]
                        );
                      }}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        selected
                          ? "bg-zinc-900 text-white border-zinc-900"
                          : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                      }`}
                    >
                      {cal.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-zinc-400 mt-2">
                {editScopeAll
                  ? "Co-host will have access to every current and future calendar in this organization."
                  : `Co-host will have access only to ${editScopeIds.length === 0 ? "the calendars you select" : `${editScopeIds.length} selected calendar${editScopeIds.length === 1 ? "" : "s"}`}.`}
              </p>
            </div>
            <button
              onClick={handleSaveScope}
              disabled={savingScope || (!editScopeAll && editScopeIds.length === 0)}
              className="w-full bg-zinc-900 text-white py-3 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              {savingScope ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* Concierge chat slide-over — opened from the serviced calendar's
          "Concierge" button. The calendar itself looks like any other. */}
      {showConciergeChat && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowConciergeChat(false)} />
          <div className="relative bg-white w-full lg:w-1/2 h-full shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 shrink-0">
              <div className="min-w-0">
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Concierge</h2>
                <p className="text-xs text-zinc-400 truncate">
                  {dashboard.calendars.find((c) => c.isConciergeServiced)?.name || dashboard.name}
                </p>
              </div>
              <button onClick={() => setShowConciergeChat(false)} className="text-zinc-400 hover:text-zinc-900 transition-colors shrink-0" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 p-4">
              <ConciergeThread
                calendarId={calendarId}
                onMenuResolved={() => {
                  loadPendingMenu();
                  fetchDashboard();
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Active Plan Detail Modal — shared component, also used by /plans page */}
      {selectedActivePlan && (
        <PlanDetailModal
          plan={{
            objectId: selectedActivePlan.objectId,
            title: selectedActivePlan.title,
            description: selectedActivePlan.description,
            image: selectedActivePlan.image,
            date: selectedActivePlan.date,
            timezone: selectedActivePlan.timezone ?? null,
            time: selectedActivePlan.time,
            hostName: selectedActivePlan.hostName,
            rsvpCount: selectedActivePlan.rsvpCount,
            location: selectedActivePlan.location,
            isPoll: selectedActivePlan.isPoll,
            pollOptionCount: selectedActivePlan.pollOptionCount,
            pollVoteCount: selectedActivePlan.pollVoteCount,
            pollClosesAt: selectedActivePlan.pollClosesAt,
            hideVenueUntilRsvp: selectedActivePlan.hideVenueUntilRsvp,
            requireApproval: selectedActivePlan.requireApproval,
            planSeriesId: selectedActivePlan.planSeriesId,
          }}
          onClose={() => setSelectedActivePlan(null)}
          onChanged={fetchDashboard}
          leafAppConnected={leafAppConnected}
          onConnectApp={() => setShowPhoneModal(true)}
          onDuplicate={(plan, pollOptions) => {
            setCreatePlanPrefill({
              title: plan.title,
              description: plan.description,
              venue: plan.location,
              imageUrl: plan.image,
              ...(plan.isPoll
                ? { mode: "poll" as const, pollOptions }
                : {}),
            });
            setSelectedActivePlan(null);
            setShowCreatePlanModal(true);
          }}
          onEdit={(plan, pollOptions, pollClosesAt) => {
            if (plan.isPoll) {
              setEditingPlanId(plan.objectId);
              setCreatePlanPrefill({
                title: plan.title,
                description: plan.description,
                venue: plan.location,
                imageUrl: plan.image,
                mode: "poll",
                pollOptions,
                pollClosesAt,
                hideVenueUntilRsvp: plan.hideVenueUntilRsvp,
                requireApproval: plan.requireApproval,
              });
              setSelectedActivePlan(null);
              setShowCreatePlanModal(true);
              return;
            }
            const planDate = plan.date ? formatDateInputInTimezone(plan.date, plan.timezone) : "";
            setEditingPlanId(plan.objectId);
            setCreatePlanPrefill({
              title: plan.title,
              description: plan.description,
              venue: plan.location,
              date: planDate,
              time: plan.time || "",
              imageUrl: plan.image,
              hideVenueUntilRsvp: plan.hideVenueUntilRsvp,
              requireApproval: plan.requireApproval,
            });
            setSelectedActivePlan(null);
            setShowCreatePlanModal(true);
          }}
          onPendingRsvpResolved={(notificationId) => {
            setDashboard((d) => d ? {
              ...d,
              pendingRsvpRequests: d.pendingRsvpRequests.filter((pr) => pr.notificationId !== notificationId),
            } : d);
          }}
          onConvertPoll={(plan, winningDate, winningTime) => {
            setPollConvertEventGroupId(plan.objectId);
            setPollConvertWinningDate(winningDate);
            setPollConvertWinningTime(winningTime);
            // Pre-fill copy/venue/image from the poll; the date input renders
            // the winning date (locked) so the owner sees what's being chosen.
            setCreatePlanPrefill({
              title: plan.title,
              description: plan.description,
              venue: plan.location,
              imageUrl: plan.image,
              date: winningDate,
              time: winningTime || "",
              hideVenueUntilRsvp: plan.hideVenueUntilRsvp,
              requireApproval: plan.requireApproval,
            });
            setSelectedActivePlan(null);
            setShowCreatePlanModal(true);
          }}
        />
      )}

      {/* Create Plan Modal (marketplace + duplicate) */}
      {showCreatePlanModal && (
        <CreatePlanModal
          calendarId={editingHostRequestCalendarId || calendarId}
          calendars={dashboard.calendars.map((c) => ({ objectId: c.objectId, name: c.name }))}
          tier={dashboard.tier}
          prefill={createPlanPrefill}
          hideVenueDefault={dashboard.calendars.find((c) => c.objectId === calendarId)?.hideVenueUntilRsvp}
          requireApprovalDefault={dashboard.calendars.find((c) => c.objectId === calendarId)?.requireApprovalDefault}
          editMode={!!editingPlanId}
          eventGroupId={editingPlanId || undefined}
          hostRequestMode={!!editingHostRequestId}
          hostRequestId={editingHostRequestId || undefined}
          pollConvertMode={!!pollConvertEventGroupId}
          pollEventGroupId={pollConvertEventGroupId || undefined}
          pollWinningDate={pollConvertWinningDate || undefined}
          pollWinningTime={pollConvertWinningTime}
          onClose={() => { setShowCreatePlanModal(false); setCreatePlanPrefill(null); setEditingPlanId(null); setEditingHostRequestId(null); setEditingHostRequestCalendarId(null); setPollConvertEventGroupId(null); setPollConvertWinningDate(null); setPollConvertWinningTime(null); }}
          onCreated={() => fetchDashboard()}
          onUpgrade={() => { setShowCreatePlanModal(false); setShowSubscription(true); }}
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

