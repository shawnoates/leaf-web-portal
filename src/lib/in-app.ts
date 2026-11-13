import type { Metadata } from "next";

/**
 * The iOS app opens Leaf pages in its in-app browser with `?inapp=1`
 * (SafariBrowser.swift). There the root layout's smart app banner would
 * advertise Leaf inside Leaf, so drop it: Next skips `other` entries whose
 * value is "", and merges `other` over the layout's.
 */
export async function hideAppBannerInApp(
  metadata: Metadata,
  searchParams: Promise<object>,
): Promise<Metadata> {
  const { inapp } = (await searchParams) as { inapp?: unknown };
  if (inapp !== "1") return metadata;
  return { ...metadata, other: { ...metadata.other, "apple-itunes-app": "" } };
}
