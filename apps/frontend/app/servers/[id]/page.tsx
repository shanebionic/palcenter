import { ServerWorkspace } from "../../../components/ServerWorkspace";
import { ApplicationShell } from "../../../components/ApplicationShell";

interface ServerPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ServerPage({ params }: ServerPageProps) {
  const { id } = await params;

  return (
    <ApplicationShell>
      <ServerWorkspace serverId={id} />
    </ApplicationShell>
  );
}
