import { ServerGuildWorkspace } from "../../../../../components/ServerGuildWorkspace";
import { ApplicationShell } from "../../../../../components/ApplicationShell";

export default async function GuildDetailPage({
  params,
}: {
  params: Promise<{ id: string; guildId: string }>;
}) {
  const { id, guildId } = await params;
  return (
    <ApplicationShell>
      <ServerGuildWorkspace serverId={id} guildId={guildId} />
    </ApplicationShell>
  );
}
