import { ServerWorkspace } from "../../../components/ServerWorkspace";

interface ServerPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ServerPage({ params }: ServerPageProps) {
  const { id } = await params;

  return <ServerWorkspace serverId={id} />;
}
