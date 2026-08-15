"use client";

import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  PasswordInput,
  Select,
  Skeleton,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useCallback, useEffect, useState } from "react";
import {
  assignPalDefenderCredential,
  getPalDefenderCredentialAssignments,
  getServers,
  revokePalDefenderCredential,
  type PalDefenderCredentialAssignment,
} from "../lib/api";
import type { PublicConnection } from "../types/servers";
import { SectionCard } from "./ui/SectionCard";

export function PalDefenderCredentialPanel() {
  const [servers, setServers] = useState<PublicConnection[]>([]);
  const [serverId, setServerId] = useState<string | null>(null);
  const [serversLoading, setServersLoading] = useState(true);
  const [serversError, setServersError] = useState("");
  const [assignments, setAssignments] = useState<
    PalDefenderCredentialAssignment[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [target, setTarget] = useState<PalDefenderCredentialAssignment | null>(
    null,
  );
  const [revoking, setRevoking] =
    useState<PalDefenderCredentialAssignment | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getServers()
      .then(setServers)
      .catch((value: unknown) =>
        setServersError(
          value instanceof Error ? value.message : "Unable to load servers.",
        ),
      )
      .finally(() => setServersLoading(false));
  }, []);

  const load = useCallback(async (selectedServerId: string) => {
    setLoading(true);
    setError("");
    try {
      setAssignments(
        await getPalDefenderCredentialAssignments(selectedServerId),
      );
    } catch (requestError) {
      setAssignments([]);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load PalDefender credentials.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (serverId) void load(serverId);
  }, [serverId, load]);

  const save = async () => {
    if (!serverId || !target) return;
    setBusy(true);
    try {
      const result = await assignPalDefenderCredential(
        serverId,
        target.userId,
        token,
      );
      notifications.show({
        color: "green",
        title: "Credential saved",
        message: `PalDefender requests from ${result.username} now use this token.`,
      });
      setTarget(null);
      setToken("");
      await load(serverId);
    } catch (requestError) {
      notifications.show({
        color: "red",
        title: "Credential save failed",
        message:
          requestError instanceof Error
            ? requestError.message
            : "Unable to save the PalDefender credential.",
      });
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (!serverId || !revoking) return;
    setBusy(true);
    try {
      await revokePalDefenderCredential(serverId, revoking.userId);
      notifications.show({
        color: "green",
        title: "Credential removed",
        message: `${revoking.username} now uses the server’s PalDefender token.`,
      });
      setRevoking(null);
      await load(serverId);
    } catch (requestError) {
      notifications.show({
        color: "red",
        title: "Credential removal failed",
        message:
          requestError instanceof Error
            ? requestError.message
            : "Unable to remove the PalDefender credential.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard>
      <Stack gap="md">
        <Stack gap="xs">
          <Title order={3}>PalDefender user credentials</Title>
          <Text size="sm" c="dimmed">
            Assign a per-user PalDefender bearer token. Each assigned user’s
            PalDefender requests use their own token; everyone else keeps the
            server’s token.
          </Text>
        </Stack>
        <Select
          label="Server"
          placeholder={serversLoading ? "Loading servers" : "Select a server"}
          searchable
          value={serverId}
          data={servers.map((server) => ({
            value: server.id,
            label: server.name,
          }))}
          onChange={(value) => setServerId(value)}
          disabled={serversLoading}
          maw={440}
        />
        {serversError && <Alert color="red">{serversError}</Alert>}
        {error && <Alert color="red">{error}</Alert>}
        {serverId && loading && <Skeleton height={160} />}
        {serverId && !loading && assignments.length === 0 && (
          <Text c="dimmed">This server has no users yet.</Text>
        )}
        {serverId &&
          !loading &&
          assignments.map((assignment) => (
            <Group key={assignment.userId} justify="space-between">
              <Stack gap="2px">
                <Group gap="xs">
                  <Text fw={600}>{assignment.username}</Text>
                  <Badge>{assignment.role}</Badge>
                  <Badge color={assignment.configured ? "green" : "gray"}>
                    {assignment.configured ? "Personal token" : "Server token"}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  {assignment.configured && assignment.updatedAt
                    ? `Updated ${new Date(assignment.updatedAt).toLocaleString()}`
                    : "Uses the server’s PalDefender bearer token."}
                </Text>
              </Stack>
              <Group gap="xs">
                <Button
                  size="xs"
                  variant={assignment.configured ? "default" : "light"}
                  onClick={() => {
                    setTarget(assignment);
                    setToken("");
                  }}
                >
                  {assignment.configured ? "Replace Token" : "Assign Token"}
                </Button>
                {assignment.configured && (
                  <Button
                    size="xs"
                    color="red"
                    variant="light"
                    onClick={() => setRevoking(assignment)}
                  >
                    Remove
                  </Button>
                )}
              </Group>
            </Group>
          ))}
      </Stack>

      <Modal
        opened={target !== null}
        onClose={() => setTarget(null)}
        title={
          target?.configured
            ? "Replace PalDefender token"
            : "Assign PalDefender token"
        }
        centered
      >
        <Stack>
          <Text>
            {target
              ? `Set the PalDefender bearer token used for ${target.username}’s PalDefender requests. The token is stored for server use only and is never displayed again.`
              : ""}
          </Text>
          <PasswordInput
            label="PalDefender bearer token"
            description="A token from this server’s PalDefender REST API settings."
            value={token}
            onChange={(event) => setToken(event.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setTarget(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              loading={busy}
              disabled={token.trim().length === 0}
              onClick={() => void save()}
            >
              Save Token
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={revoking !== null}
        onClose={() => setRevoking(null)}
        title="Remove PalDefender token?"
        centered
      >
        <Stack>
          <Alert color="yellow">
            {revoking
              ? `Remove the personal PalDefender token for ${revoking.username}? Their PalDefender requests will use the server’s token immediately.`
              : ""}
          </Alert>
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setRevoking(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button color="red" loading={busy} onClick={() => void revoke()}>
              Remove Token
            </Button>
          </Group>
        </Stack>
      </Modal>
    </SectionCard>
  );
}
