"use client";

import MarketingPage from "@/components/marketing/MarketingPage";
import { personalContent } from "@/components/marketing/content/personal";

export default function PersonalPage() {
  return <MarketingPage content={personalContent} />;
}
