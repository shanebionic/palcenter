"use client";

import {
  Accordion,
  Alert,
  Badge,
  Button,
  Group,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";
import { useCallback, useEffect, useState } from "react";
import { getCompanionStatus, refreshCompanionStatus } from "../lib/api";
import type {
  CompanionConnectionState,
  CompanionStatus,
} from "../types/companion";
import { SectionCard } from "./ui/SectionCard";
import { SectionHeader } from "./ui/SectionHeader";

const presentation: Record<
  CompanionConnectionState,
  { label: string; color: string; message: string }
> = {
  connected: {
    label: "Connected",
    color: "teal",
    message: "Authenticated capability negotiation succeeded.",
  },
  disabled: {
    label: "Disabled",
    color: "gray",
    message: "Companion discovery is disabled for this server.",
  },
  unreachable: {
    label: "Unreachable",
    color: "gray",
    message:
      "Companion was not found at the configured address. Standard server management is unaffected.",
  },
  authentication_required: {
    label: "Authentication required",
    color: "yellow",
    message: "Companion was detected. Configure its API token to continue.",
  },
  authentication_failed: {
    label: "Authentication failed",
    color: "red",
    message: "Check that the configured Companion API token is current.",
  },
  malformed_response: {
    label: "Invalid response",
    color: "orange",
    message:
      "The Companion returned an unexpected response. Check its logs and version.",
  },
  incompatible_contract: {
    label: "Incompatible API",
    color: "orange",
    message:
      "The Companion API contract is not supported by this PalCenter build.",
  },
};

export function CompanionStatusCard({ serverId }: { serverId: string }) {
  const [status, setStatus] = useState<CompanionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(
    async (refresh = false) => {
      setLoading(true);
      try {
        setStatus(
          await (refresh
            ? refreshCompanionStatus(serverId)
            : getCompanionStatus(serverId)),
        );
      } finally {
        setLoading(false);
      }
    },
    [serverId],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const state = status?.state ?? "unreachable";
  const view = presentation[state];
  const supported = Object.entries(status?.capabilities ?? {}).filter(
    ([, value]) => value.supported,
  );
  const runtime = status?.version?.runtime;
  return (
    <SectionCard>
      <Stack gap="md">
        <SectionHeader
          title="PalCenter Companion"
          description="Optional authoritative server extension"
          action={
            <Button
              variant="light"
              size="xs"
              loading={loading}
              onClick={() => void load(true)}
            >
              Refresh
            </Button>
          }
        />
        <Group justify="space-between">
          <Text fw={600}>{view.label}</Text>
          <Badge color={view.color} variant="light">
            {status?.health === "healthy" ? "Healthy" : view.label}
          </Badge>
        </Group>
        {state !== "connected" && (
          <Alert color={view.color}>{view.message}</Alert>
        )}
        {state === "connected" && status?.version && (
          <>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
              <Text size="sm">
                Version: {status.version.applicationVersion}
              </Text>
              <Text size="sm">API: {status.version.apiVersion}</Text>
              <Text size="sm">
                Palworld: {status.version.palworldVersion ?? "Not reported"}
              </Text>
              <Text size="sm">
                Uptime:{" "}
                {runtime
                  ? `${Math.floor(runtime.uptimeSeconds / 60)} minutes`
                  : "Not reported"}
              </Text>
              <Text size="sm">Supported capabilities: {supported.length}</Text>
            </SimpleGrid>
            <Accordion variant="contained">
              <Accordion.Item value="advanced">
                <Accordion.Control>Advanced details</Accordion.Control>
                <Accordion.Panel>
                  <Stack gap={4}>
                    <Text size="sm">
                      Build: {status.version.buildCommit ?? "Not reported"}
                    </Text>
                    <Text size="sm">
                      Branch: {status.version.buildBranch ?? "Not reported"}
                    </Text>
                    <Text size="sm">
                      Compiler: {status.version.compiler ?? "Not reported"}
                    </Text>
                    <Text size="sm">
                      Instance: {runtime?.instanceId ?? "Not reported"}
                    </Text>
                    <Text size="sm">
                      Capabilities:{" "}
                      {supported.length
                        ? supported.map(([name]) => name).join(", ")
                        : "Discovery only"}
                    </Text>
                    {runtime &&
                      Object.entries(runtime.checks).map(([name, value]) => (
                        <Text size="sm" key={name}>
                          {name}: {value}
                        </Text>
                      ))}
                    {Object.entries(status.version.compatibility).map(
                      ([name, value]) => (
                        <Text size="sm" key={name}>
                          {name}: {value}
                        </Text>
                      ),
                    )}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          </>
        )}
      </Stack>
    </SectionCard>
  );
}
