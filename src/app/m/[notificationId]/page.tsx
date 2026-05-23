import type { Metadata } from "next";
import Parse from "@/lib/parse";
import MemoryClient from "./MemoryClient";

type Photo = {
  objectId: string;
  url: string | null;
  caption: string | null;
  uploadedAt: string;
  uploaderName: string;
  uploaderId: string | null;
  eventGroupId: string | null;
};

type AttendeeMemoryInfo = {
  event: {
    objectId: string;
    title: string;
    description: string;
    image: string | null;
    expiryDate: string | null;
    location: { name: string; address: string } | null;
    host: { name: string } | null;
    calendarName: string | null;
  };
  calendar?: {
    objectId: string;
    shareId: string | null;
    name: string | null;
    profilePhoto?: string | null;
  } | null;
  viewerRole?: "owner" | "host" | "attendee";
  canMarkAttendance?: boolean;
  recap?: {
    rsvpCount: number;
    photoCount: number;
    dayOfWeek: string | null;
    timeOfDay: string | null;
    venueName: string | null;
    weeksSinceLastPlan: number | null;
  };
  attendee: { name: string };
  attendees?: {
    notificationId: string;
    name: string;
    checkedInViaMobile: boolean;
    checkedInAt: string | null;
    attendedAt: string | null;
    attendedSource: string | null;
  }[];
  photos: Photo[];
  photoCount: number;
  limits: {
    maxBytes: number;
    maxPerAttendee: number;
    maxPerEvent: number;
  };
};

async function fetchInfo(
  notificationId: string
): Promise<{ info: AttendeeMemoryInfo | null; error: string | null }> {
  try {
    const result = (await Parse.Cloud.run("getAttendeeMemoryInfo", {
      notificationId,
    })) as AttendeeMemoryInfo;
    return { info: result || null, error: result ? null : "No data returned." };
  } catch (err) {
    console.error("[/m] getAttendeeMemoryInfo failed:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { info: null, error: message };
  }
}

type PageProps = {
  params: Promise<{ notificationId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { notificationId } = await params;
  const { info } = await fetchInfo(notificationId);
  if (!info) {
    return {
      title: "Add your photos · Leaf",
      description: "Share photos from the event you attended.",
    };
  }
  const title = `Photos from ${info.event.title}`;
  const description = `Add your photos from ${info.event.title} on Leaf.`;
  const icons = info.calendar?.profilePhoto
    ? {
        icon: info.calendar.profilePhoto,
        apple: info.calendar.profilePhoto,
      }
    : undefined;
  return {
    title: `${title} · Leaf`,
    description,
    icons,
    openGraph: {
      title,
      description,
      type: "website",
      url: `https://os.joinleaf.com/m/${notificationId}`,
      images: info.event.image ? [{ url: info.event.image }] : undefined,
      siteName: "Leaf",
    },
  };
}

export default async function MemoryPage({ params }: PageProps) {
  const { notificationId } = await params;
  const { info, error } = await fetchInfo(notificationId);
  return (
    <MemoryClient
      notificationId={notificationId}
      initialInfo={info}
      initialError={error}
    />
  );
}
