import { ServerWorkspace } from "../../../components/ServerWorkspace";
import { ApplicationShell } from "../../../components/ApplicationShell";

interface ServerPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    tab?: string;
    base?: string;
  }>;
}

export default async function ServerPage({
  params,
  searchParams,
}: ServerPageProps) {
  const { id } = await params;
  const { tab, base } = await searchParams;

  return (
    <ApplicationShell>
      <ServerWorkspace
        serverId={id}
        initialTab={
          tab === "players"
            ? "players"
            : tab === "guilds"
              ? "guilds"
              : tab === "bases"
                ? "bases"
                : tab === "map"
                  ? "map"
                  : "overview"
        }
        initialBaseId={base && base.length > 0 ? base : undefined}
      />
    </ApplicationShell>
  );
}
