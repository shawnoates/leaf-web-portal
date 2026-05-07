import UnsubscribeClient from "./UnsubscribeClient";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string; t?: string }>;
}) {
  const params = await searchParams;
  return <UnsubscribeClient userId={params.u || ""} token={params.t || ""} />;
}
