import ChatShell from "@/components/Chat/ChatShell";

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventGroupId: string }>;
  // `?draft=` seeds the composer without sending. The host assistant's Needs
  // You card links here when it has a message drafted, so the host reads it
  // against the live conversation and sends it themselves.
  searchParams: Promise<{ draft?: string | string[] }>;
}) {
  const { eventGroupId } = await params;
  const { draft } = await searchParams;
  const initialDraft = Array.isArray(draft) ? draft[0] : draft;
  return (
    <ChatShell
      eventGroupId={eventGroupId}
      initialDraft={initialDraft?.slice(0, 2000)}
    />
  );
}
