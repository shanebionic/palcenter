import { redirect } from "next/navigation";

export default async function PlayersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/servers/${encodeURIComponent(id)}?tab=players`);
}
