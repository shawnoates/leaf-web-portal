import type { Metadata } from "next";
import { hideAppBannerInApp } from "@/lib/in-app";
import OrgCalendarClient from "./OrgCalendarClient";

export async function generateMetadata({ searchParams }: { searchParams: Promise<object> }): Promise<Metadata> {
  return hideAppBannerInApp({}, searchParams);
}

export default function OrgCalendarPage() {
  return <OrgCalendarClient />;
}
