import { redirect } from "next/navigation";

export default async function PalDefenderPlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ playerId: string }>;
  searchParams: Promise<{ serverId?: string }>;
}) {
  const { playerId } = await params;
  const { serverId } = await searchParams;
  if (serverId) {
    redirect(
      `/servers/${encodeURIComponent(serverId)}/players/${encodeURIComponent(playerId)}`,
    );
  }
  redirect("/paldefender/players");
}
