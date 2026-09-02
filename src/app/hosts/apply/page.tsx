import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";
import HostApplyForm from "./HostApplyForm";

const TITLE = "Host a night with Leaf";
const DESCRIPTION =
  "Contract work hosting neighborhood events. Tell us where you can get to and when you're free, and we'll get in touch when a night near you needs a host.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/hosts/apply` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: `${SITE_URL}/hosts/apply`,
    siteName: "Leaf",
  },
  // The audience arrives from a Craigslist relay, not from search, and a
  // half-filled roster page is not something we want ranking for "host jobs".
  robots: { index: false, follow: false },
};

export default function HostApplyPage() {
  return <HostApplyForm />;
}
