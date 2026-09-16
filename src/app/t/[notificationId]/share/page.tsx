import type { Metadata } from "next";
import Parse from "@/lib/parse";
import ShareKitClient, { type SharePack } from "./ShareKitClient";

// The host share kit: a card, a caption, a link, and one-tap targets.
//
// Same bearer as the checklist it hangs off (/t/<notificationId>): the
// unguessable EventNotification id. Same reason to stay OUT of the AASA.
//
// Nothing on this page posts anything. Every button hands the host material
// and gets out of the way. Leaf has no account of theirs and does not want one.

type PageProps = {
  params: Promise<{ notificationId: string }>;
};

async function fetchPack(
  notificationId: string,
): Promise<{ pack: SharePack | null; error: string | null }> {
  try {
    const result = (await Parse.Cloud.run("getHostSharePack", {
      notificationId,
    })) as SharePack;
    return { pack: result, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "We couldn't load the share kit.";
    return { pack: null, error: message };
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { notificationId } = await params;
  const { pack } = await fetchPack(notificationId);
  return {
    title: `${pack ? `${pack.title} — share kit` : "Share kit"} · Leaf`,
    description: "Post about your plan.",
    robots: { index: false, follow: false },
  };
}

export default async function ShareKitPage({ params }: PageProps) {
  const { notificationId } = await params;
  const { pack, error } = await fetchPack(notificationId);
  return <ShareKitClient notificationId={notificationId} initial={pack} initialError={error} />;
}
