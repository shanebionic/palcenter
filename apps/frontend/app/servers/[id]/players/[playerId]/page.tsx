import { ServerPlayerWorkspace } from "../../../../../components/ServerPlayerWorkspace";

export default async function ServerPlayerPage({
  params,
}: {
  params: Promise<{ id: string; playerId: string }>;
}) {
  const { id, playerId } = await params;
  return <ServerPlayerWorkspace serverId={id} playerId={playerId} />;
}
