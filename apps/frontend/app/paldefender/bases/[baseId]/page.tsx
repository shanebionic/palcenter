import { redirect } from "next/navigation";

export default async function PalDefenderBaseDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ baseId: string }>;
  searchParams: Promise<{ serverId?: string }>;
}) {
  const { baseId } = await params;
  const { serverId } = await searchParams;
  if (serverId) {
    redirect(
      `/servers/${encodeURIComponent(serverId)}/bases/${encodeURIComponent(baseId)}`,
    );
  }
  redirect("/paldefender/bases");
}
