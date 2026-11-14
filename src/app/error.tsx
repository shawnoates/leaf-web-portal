"use client";

import CrashScreen from "@/components/CrashScreen";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <CrashScreen error={error} retry={unstable_retry} where="page" />;
}
