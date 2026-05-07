import ChatShell from "@/components/Chat/ChatShell";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ eventGroupId: string }>;
}) {
  const { eventGroupId } = await params;
  return <ChatShell eventGroupId={eventGroupId} />;
}
