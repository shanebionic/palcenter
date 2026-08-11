import { redirect } from "next/navigation";

export default async function PalDefenderGuildDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<{ serverId?: string }>;
}) {
  const { guildId } = await params;
  const { serverId } = await searchParams;
  if (serverId) {
    redirect(
      `/servers/${encodeURIComponent(serverId)}/guilds/${encodeURIComponent(guildId)}`,
    );
  }
  redirect("/paldefender/guilds");
}
