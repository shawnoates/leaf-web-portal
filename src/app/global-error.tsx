"use client";

import CrashScreen from "@/components/CrashScreen";

// Replaces the root layout when it (not a page) throws, so it brings its own
// <html> and <body>.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <title>This page couldn’t load</title>
        <CrashScreen error={error} retry={unstable_retry} where="root" />
      </body>
    </html>
  );
}
