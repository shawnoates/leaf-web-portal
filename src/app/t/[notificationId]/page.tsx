import type { Metadata } from "next";
import Parse from "@/lib/parse";
import ChecklistClient, { type HostChecklist } from "./ChecklistClient";

// The host assistant's checklist, for hosts we can't reach by push.
//
// Addressed by EventNotification id exactly like the /m/ memory page: the
// unguessable object id is the bearer token, so a host with no app and no
// password can work their list straight from a text.
//
// This route must stay OUT of the AASA (/p/* and /open/p/* only). If it were
// added, an iOS host tapping the SMS would be bounced into the app instead of
// landing on this page — which is the whole point of the SMS path.

type PageProps = {
  params: Promise<{ notificationId: string }>;
};

async function fetchChecklist(
  notificationId: string,
): Promise<{ data: HostChecklist | null; error: string | null }> {
  try {
    const result = (await Parse.Cloud.run("getHostChecklist", {
      notificationId,
    })) as HostChecklist;
    return { data: result, error: null };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "We couldn't load this checklist.";
    return { data: null, error: message };
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { notificationId } = await params;
  const { data } = await fetchChecklist(notificationId);
  const title = data ? `${data.planTitle} — your checklist` : "Your checklist";
  return {
    title: `${title} · Leaf`,
    description: "What's left to sort before your plan.",
    // A checklist is private to one host. Keep it out of search results even
    // though the id is unguessable.
    robots: { index: false, follow: false },
  };
}

export default async function HostChecklistPage({ params }: PageProps) {
  const { notificationId } = await params;
  const { data, error } = await fetchChecklist(notificationId);
  return (
    <ChecklistClient
      notificationId={notificationId}
      initial={data}
      initialError={error}
    />
  );
}
