import type { Metadata } from "next";
import { hideAppBannerInApp } from "@/lib/in-app";
import MeClient from "./MeClient";

export async function generateMetadata({ searchParams }: { searchParams: Promise<object> }): Promise<Metadata> {
  return hideAppBannerInApp(
    { title: "Your plans · Leaf", robots: { index: false, follow: false } },
    searchParams,
  );
}

export default function MePage() {
  return <MeClient />;
}
