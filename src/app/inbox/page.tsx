import { Suspense } from "react";
import InboxClient from "./InboxClient";

// useSearchParams (deep-linking into a thread from an email) requires a
// Suspense boundary at the route level.
export default function InboxPage() {
  return (
    <Suspense fallback={null}>
      <InboxClient />
    </Suspense>
  );
}
