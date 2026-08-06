import { PalDefenderPlayerWorkspace } from "../../../../components/PalDefenderPlayerWorkspace";

export default async function PalDefenderPlayerPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  return <PalDefenderPlayerWorkspace playerId={playerId} />;
}
