"use client";

import {
  Alert,
  Badge,
  Card,
  Drawer,
  Group,
  Loader,
  Stack,
  Text,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { getAutomationTaskHistory } from "../lib/api";
import { formatDateTime, taskTypeLabel } from "../lib/automation";
import type {
  AutomationExecutionDetail,
  AutomationTask,
} from "../types/automation";

interface AutomationHistoryDrawerProps {
  task: AutomationTask | null;
  onClose(): void;
}

export function AutomationHistoryDrawer({
  task,
  onClose,
}: AutomationHistoryDrawerProps) {
  const [executions, setExecutions] = useState<AutomationExecutionDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!task) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getAutomationTaskHistory(task.id)
      .then((result) => {
        if (!cancelled) setExecutions(result);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load execution history.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [task]);

  return (
    <Drawer
      opened={task !== null}
      onClose={onClose}
      title={task ? `Execution history · ${task.name}` : "Execution history"}
      position="right"
      size="lg"
    >
      {loading && (
        <Group justify="center" py="xl">
          <Loader size="sm" />
          <Text c="dimmed">Loading execution history…</Text>
        </Group>
      )}
      {error && <Alert color="red">{error}</Alert>}
      {!loading && !error && executions.length === 0 && (
        <Text c="dimmed">This task has not run yet.</Text>
      )}
      <Stack gap="md">
        {executions.map((execution) => (
          <Card key={execution.id} withBorder radius="md" p="md">
            <Stack gap="xs">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text fw={700}>{execution.taskName}</Text>
                  <Text size="sm" c="dimmed">
                    {taskTypeLabel(execution.taskType)} · {execution.serverName}
                  </Text>
                </div>
                <Badge
                  color={
                    execution.result === "success"
                      ? "teal"
                      : execution.result === "failure"
                        ? "red"
                        : "cyan"
                  }
                  variant="light"
                >
                  {execution.result}
                </Badge>
              </Group>

              <Text size="sm">{execution.actionSummary}</Text>
              <Text
                size="sm"
                c={execution.result === "failure" ? "red.4" : undefined}
              >
                {execution.resultMessage}
              </Text>

              <Group gap="lg">
                <HistoryValue
                  label="Trigger"
                  value={
                    execution.trigger === "manual" ? "Manual" : "Scheduled"
                  }
                />
                <HistoryValue
                  label="Started"
                  value={formatDateTime(execution.startedAt)}
                />
                <HistoryValue
                  label="Finished"
                  value={formatDateTime(execution.finishedAt)}
                />
                <HistoryValue
                  label="Duration"
                  value={formatDuration(execution.durationMs)}
                />
              </Group>

              {execution.errorMessage && (
                <Alert color="red" title="Error details">
                  {execution.errorMessage}
                </Alert>
              )}
            </Stack>
          </Card>
        ))}
      </Stack>
    </Drawer>
  );
}

function HistoryValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
        {label}
      </Text>
      <Text size="sm">{value}</Text>
    </div>
  );
}

function formatDuration(durationMs: number | null): string {
  if (durationMs === null) return "In progress";
  if (durationMs < 1_000) return `${durationMs} ms`;
  return `${(durationMs / 1_000).toFixed(durationMs < 10_000 ? 1 : 0)} s`;
}
