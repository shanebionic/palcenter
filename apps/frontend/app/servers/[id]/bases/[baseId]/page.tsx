import { ServerBaseWorkspace } from "../../../../../components/ServerBaseWorkspace";
import { ApplicationShell } from "../../../../../components/ApplicationShell";

export default async function BaseDetailPage({
  params,
}: {
  params: Promise<{ id: string; baseId: string }>;
}) {
  const { id, baseId } = await params;
  return (
    <ApplicationShell>
      <ServerBaseWorkspace serverId={id} baseId={baseId} />
    </ApplicationShell>
  );
}
