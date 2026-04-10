import type { Metadata } from "next";
import ChatRedirect from "./ChatRedirect";

// Generic OG metadata — the notification id is opaque/private so we don't
// fetch plan details here. The host already knows what plan they hosted.
export const metadata: Metadata = {
  title: "Open the conversation · Leaf",
  description: "Tap to open the plan chat in the Leaf app.",
  openGraph: {
    title: "Open the conversation",
    description: "Tap to open the plan chat in the Leaf app.",
    type: "website",
    siteName: "Leaf",
  },
};

type PageProps = {
  params: Promise<{ notificationId: string }>;
};

export default async function ChatSharePage({ params }: PageProps) {
  const { notificationId } = await params;
  // Existing iOS deep link handler from AppVM.swift:
  //   leaf://planChat?planId={eventNotificationId}
  // PathView navigates the current user to that plan's chat tab.
  const deepLink = `leaf://planChat?planId=${notificationId}`;
  const appStoreUrl = "https://apps.apple.com/app/leaf";

  return (
    <div
      style={{
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 20px",
        textAlign: "center",
        color: "#52525b",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <ChatRedirect deepLink={deepLink} appStoreUrl={appStoreUrl} />
      <h1
        style={{
          fontSize: 22,
          fontWeight: 300,
          letterSpacing: "0.02em",
          color: "#18181b",
          margin: "0 0 12px 0",
        }}
      >
        Opening Leaf…
      </h1>
      <p style={{ fontSize: 14, margin: "0 0 24px 0" }}>
        Taking you to the plan chat.
      </p>
      <a
        href={deepLink}
        style={{
          display: "inline-block",
          backgroundColor: "#18181b",
          color: "#ffffff",
          padding: "12px 32px",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          textDecoration: "none",
          borderRadius: 8,
        }}
      >
        Open in Leaf
      </a>
      <p style={{ fontSize: 12, marginTop: 24 }}>
        Don&rsquo;t have the app?{" "}
        <a href={appStoreUrl} style={{ color: "#18181b" }}>
          Download Leaf
        </a>
      </p>
    </div>
  );
}
