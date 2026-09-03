"use client";

import MarketingPage from "@/components/marketing/MarketingPage";
import { organizationsContent } from "@/components/marketing/content/organizations";

export default function OrganizationsPage() {
  return <MarketingPage content={organizationsContent} />;
}
