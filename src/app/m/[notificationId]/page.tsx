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
  attendee: { name: string };
  photos: Photo[];
  photoCount: number;
  limits: {
    maxBytes: number;
    maxPerAttendee: number;
    maxPerEvent: number;
  };
};

async function fetchInfo(notificationId: string): Promise<AttendeeMemoryInfo | null> {
  try {
    const result = (await Parse.Cloud.run("getAttendeeMemoryInfo", {
      notificationId,
    })) as AttendeeMemoryInfo;
    return result || null;
  } catch (err) {
    console.error("[/m] getAttendeeMemoryInfo failed:", err);
    return null;
  }
}

type PageProps = {
  params: Promise<{ notificationId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { notificationId } = await params;
  const info = await fetchInfo(notificationId);
  if (!info) {
    return {
      title: "Add your photos · Leaf",
      description: "Share photos from the event you attended.",
    };
  }
  const title = `Photos from ${info.event.title}`;
  const description = `Add your photos from ${info.event.title} on Leaf.`;
  return {
    title: `${title} · Leaf`,
    description,
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
  const info = await fetchInfo(notificationId);
  return <MemoryClient notificationId={notificationId} initialInfo={info} />;
}
