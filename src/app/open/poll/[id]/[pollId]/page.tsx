import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string; pollId: string }>;
};

// Universal Link bouncer registered in
// .well-known/apple-app-site-association/route.ts under /open/poll/*. iOS
// intercepts taps to this URL and opens the Leaf app via AppVM.handleURL
// when installed (a distinct path from /poll/... so interception fires even
// though the user is already on that page). Reaching this server render
// means iOS did not intercept — no app, or a build that doesn't claim this
// host — so send them back to the guest vote form rather than the App
// Store: they came here to vote, and the form lets them.
export default async function OpenPollBouncer({ params }: PageProps) {
  const { id, pollId } = await params;
  redirect(`/poll/${id}/${pollId}`);
}
