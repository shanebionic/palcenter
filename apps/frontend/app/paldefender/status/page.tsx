"use client";

import { Alert, SimpleGrid, Stack } from "@mantine/core";
import {
  IconActivityHeartbeat,
  IconClock,
  IconPlugConnected,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { ApplicationShell } from "../../../components/ApplicationShell";
import { BrandedLoader } from "../../../components/BrandedLoader";
import { PageHeader } from "../../../components/PageHeader";
import { StatCard } from "../../../components/ui/StatCard";
import {
  getPalDefenderStatus,
  type PalDefenderStatus,
} from "../../../lib/api";

export default function PalDefenderStatusPage() {
  const [status, setStatus] = useState<PalDefenderStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void getPalDefenderStatus().then(setStatus).catch((value: unknown) => {
      setError(value instanceof Error ? value.message : "Unable to load status.");
    });
  }, []);

  return (
    <ApplicationShell>
      <Stack gap="xl">
        <PageHeader
          eyebrow="PalDefender"
          title="Status"
          description="Live connectivity and version information from the configured PalDefender server."
        />
        {error && <Alert color="red">{error}</Alert>}
        {!status && !error && <BrandedLoader message="Checking PalDefender" />}
        {status && (
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <StatCard
              label="Connected"
              value={status.connected ? "Connected" : "Disconnected"}
              color={status.connected ? "teal" : "red"}
              icon={<IconPlugConnected size={22} />}
            />
            <StatCard
              label="Version"
              value={status.version}
              icon={<IconActivityHeartbeat size={22} />}
            />
            <StatCard
              label="Response time"
              value={`${status.responseTime} ms`}
              icon={<IconClock size={22} />}
            />
          </SimpleGrid>
        )}
      </Stack>
    </ApplicationShell>
  );
}
