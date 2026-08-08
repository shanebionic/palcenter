import { ServerPlayersPage } from "../../../../components/ServerPlayersPage";

export default async function PlayersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ServerPlayersPage serverId={id} />;
}
