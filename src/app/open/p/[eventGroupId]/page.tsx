import { redirect } from "next/navigation";

const APP_STORE_URL =
  "https://apps.apple.com/us/app/leaf-build-your-community/id1040588046";

type PageProps = {
  params: Promise<{ eventGroupId: string }>;
  searchParams: Promise<{ copy?: string; rsvp?: string }>;
};

// Universal Link bouncer registered in
// .well-known/apple-app-site-association/route.ts under /open/p/*. iOS
// intercepts taps to this URL and opens the Leaf app directly via
// AppVM.handleURL when installed. If we reach this server render, iOS did
// not intercept — the user doesn't have the app, so route them somewhere
// useful: rsvp=1 returns them to the plan page with the web RSVP modal
// open; otherwise to the App Store.
export default async function OpenPlanBouncer({ params, searchParams }: PageProps) {
  const { eventGroupId } = await params;
  const { rsvp } = await searchParams;
  if (rsvp === "1") {
    redirect(`/p/${eventGroupId}?rsvp=1`);
  }
  redirect(APP_STORE_URL);
}
