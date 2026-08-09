import { ServerWorkspace } from "../../../components/ServerWorkspace";
import { ApplicationShell } from "../../../components/ApplicationShell";

interface ServerPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    tab?: string;
  }>;
}

export default async function ServerPage({
  params,
  searchParams,
}: ServerPageProps) {
  const { id } = await params;
  const { tab } = await searchParams;

  return (
    <ApplicationShell>
      <ServerWorkspace
        serverId={id}
        initialTab={tab === "players" ? "players" : "overview"}
      />
    </ApplicationShell>
  );
}
