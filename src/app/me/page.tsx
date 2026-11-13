import type { Metadata } from "next";
import MeClient from "./MeClient";

// The iOS app opens Leaf links (the "Still coming?" reminder push) in its
// in-app browser with ?inapp=1. An empty value drops the root layout's smart
// app banner there, so Leaf doesn't advertise itself inside Leaf.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { inapp } = await searchParams;
  return {
    title: "Your plans · Leaf",
    robots: { index: false, follow: false },
    ...(inapp === "1" ? { other: { "apple-itunes-app": "" } } : {}),
  };
}

export default function MePage() {
  return <MeClient />;
}
