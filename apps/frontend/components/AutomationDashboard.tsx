"use client";

import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  Pagination,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconCalendarClock,
  IconCheck,
  IconClockPlay,
  IconDots,
  IconEdit,
  IconPlayerPlay,
  IconPlus,
  IconPower,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createAutomationTask,
  deleteAutomationTask,
  getAutomationSummary,
  getAutomationTasks,
  getServers,
  getSession,
  runAutomationTask,
  setAutomationTaskEnabled,
  updateAutomationTask,
} from "../lib/api";
import {
  describeSchedule,
  formatDateTime,
  runNowConfirmation,
  taskConfigurationSummary,
  taskTypeLabel,
} from "../lib/automation";
import type {
  AutomationListQuery,
  AutomationSummary,
  AutomationTask,
  AutomationTaskInput,
  AutomationTaskType,
} from "../types/automation";
import type { PublicConnection } from "../types/servers";
import { AutomationTaskDialog } from "./AutomationTaskDialog";
import { BrandedLoader } from "./BrandedLoader";
import { PageHeader } from "./PageHeader";

const pageSize = 25;

export function AutomationDashboard() {
  const [tasks, setTasks] = useState<AutomationTask[]>([]);
  const [summary, setSummary] = useState<AutomationSummary | null>(null);
  const [servers, setServers] = useState<PublicConnection[]>([]);
  const [isAdministrator, setIsAdministrator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AutomationTask | null>(null);
  const [search, setSearch] = useState("");
  const [serverId, setServerId] = useState<string | null>(null);
  const [taskType, setTaskType] = useState<AutomationTaskType | null>(null);
  const [enabled, setEnabled] = useState<string | null>(null);
  const [sortBy, setSortBy] =
    useState<NonNullable<AutomationListQuery["sortBy"]>>("nextRunAt");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    try {
      const [taskResult, summaryResult] = await Promise.all([
        getAutomationTasks({
          search: search || undefined,
          serverId: serverId || undefined,
          taskType: taskType || undefined,
          enabled: enabled === null ? undefined : enabled === "enabled",
          sortBy,
          order,
        }),
        getAutomationSummary(),
      ]);
      setTasks(taskResult);
      setSummary(summaryResult);
      setError(null);
    } catch (requestError) {
      setError(messageFor(requestError));
    } finally {
      setLoading(false);
    }
  }, [enabled, order, search, serverId, sortBy, taskType]);

  useEffect(() => {
    void Promise.all([getServers(), getSession()])
      .then(([serverResult, session]) => {
        setServers(serverResult);
        setIsAdministrator(session.user.role === "administrator");
      })
      .catch((requestError) => setError(messageFor(requestError)));
  }, []);

  useEffect(() => {
    const delay = setTimeout(() => void load(), 200);
    const timer = setInterval(() => void load(), 15_000);
    return () => {
      clearTimeout(delay);
      clearInterval(timer);
    };
  }, [load]);

  useEffect(
    () => setPage(1),
    [enabled, search, serverId, sortBy, order, taskType],
  );

  const visibleTasks = useMemo(
    () => tasks.slice((page - 1) * pageSize, page * pageSize),
    [page, tasks],
  );

  const save = async (input: AutomationTaskInput) => {
    setSaving(true);
    try {
      if (editing) await updateAutomationTask(editing.id, input);
      else await createAutomationTask(input);
      setDialogOpen(false);
      setEditing(null);
      notifications.show({
        color: "teal",
        title: editing ? "Task updated" : "Task created",
        message: `${input.name} is ready.`,
        icon: <IconCheck size={18} />,
      });
      await load();
    } catch (requestError) {
      notifications.show({
        color: "red",
        title: "Unable to save task",
        message: messageFor(requestError),
      });
    } finally {
      setSaving(false);
    }
  };

  const perform = async (
    task: AutomationTask,
    action: "toggle" | "run" | "delete",
  ) => {
    try {
      if (action === "toggle") {
        await setAutomationTaskEnabled(task.id, !task.enabled);
      } else if (action === "run") {
        const confirmation = runNowConfirmation(task);
        if (confirmation && !window.confirm(confirmation)) return;
        const { execution } = await runAutomationTask(task.id);
        notifications.show({
          color: execution.result === "success" ? "teal" : "red",
          title:
            execution.result === "success" ? "Task completed" : "Task failed",
          message: execution.errorMessage ?? `${task.name} ran successfully.`,
        });
      } else {
        if (
          !window.confirm(
            `Delete “${task.name}”? Its execution history will also be removed.`,
          )
        ) {
          return;
        }
        await deleteAutomationTask(task.id);
      }
      await load();
    } catch (requestError) {
      notifications.show({
        color: "red",
        title: "Automation action failed",
        message: messageFor(requestError),
      });
    }
  };

  if (loading) return <BrandedLoader message="Loading automation tasks" />;

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Server Automation"
        title="Automation"
        description="Schedule and manage recurring tasks across every Palworld server."
        action={
          isAdministrator ? (
            <Button
              leftSection={<IconPlus size={18} />}
              disabled={servers.length === 0}
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              New Task
            </Button>
          ) : null
        }
      />

      {error && <Alert color="red">{error}</Alert>}
      {servers.length === 0 && (
        <Alert color="cyan" title="Add a server first">
          Automation tasks need a configured Palworld server.
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }}>
        <SummaryCard
          label="Active Tasks"
          value={String(summary?.activeTasks ?? 0)}
          icon={<IconPower size={20} />}
          color="teal"
        />
        <SummaryCard
          label="Disabled Tasks"
          value={String(summary?.disabledTasks ?? 0)}
          icon={<IconPower size={20} />}
          color="gray"
        />
        <SummaryCard
          label="Failed Today"
          value={String(summary?.failedToday ?? 0)}
          icon={<IconAlertTriangle size={20} />}
          color={(summary?.failedToday ?? 0) > 0 ? "red" : "gray"}
        />
        <SummaryCard
          label="Next Scheduled Run"
          value={formatDateTime(summary?.nextScheduledRun ?? null)}
          icon={<IconCalendarClock size={20} />}
          color="cyan"
          compact
        />
      </SimpleGrid>

      <Card className="pc-panel" withBorder radius="lg" p={0}>
        <Group p="lg" gap="sm" align="flex-end">
          <TextInput
            aria-label="Search automation tasks"
            placeholder="Search tasks or servers"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            style={{ flex: "2 1 240px" }}
          />
          <Select
            aria-label="Filter by server"
            placeholder="All servers"
            clearable
            searchable
            data={servers.map((server) => ({
              value: server.id,
              label: server.name,
            }))}
            value={serverId}
            onChange={setServerId}
            style={{ flex: "1 1 180px" }}
          />
          <Select
            aria-label="Filter by task type"
            placeholder="All task types"
            clearable
            data={[
              { value: "broadcast_message", label: "Broadcast Message" },
              { value: "save_world", label: "Save World" },
              { value: "shutdown", label: "Graceful Shutdown" },
            ]}
            value={taskType}
            onChange={(value) =>
              setTaskType((value as AutomationTaskType | null) ?? null)
            }
            style={{ flex: "1 1 180px" }}
          />
          <Select
            aria-label="Filter by task status"
            placeholder="All statuses"
            clearable
            data={[
              { value: "enabled", label: "Enabled" },
              { value: "disabled", label: "Disabled" },
            ]}
            value={enabled}
            onChange={setEnabled}
            style={{ flex: "1 1 160px" }}
          />
        </Group>

        <Table.ScrollContainer minWidth={1000}>
          <Table verticalSpacing="md" horizontalSpacing="lg" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <SortableHeader
                  label="Task Name"
                  field="name"
                  active={sortBy}
                  order={order}
                  onSort={(field) =>
                    updateSort(field, sortBy, order, setSortBy, setOrder)
                  }
                />
                <SortableHeader
                  label="Server"
                  field="server"
                  active={sortBy}
                  order={order}
                  onSort={(field) =>
                    updateSort(field, sortBy, order, setSortBy, setOrder)
                  }
                />
                <Table.Th>Task Type</Table.Th>
                <SortableHeader
                  label="Enabled"
                  field="enabled"
                  active={sortBy}
                  order={order}
                  onSort={(field) =>
                    updateSort(field, sortBy, order, setSortBy, setOrder)
                  }
                />
                <SortableHeader
                  label="Last Run"
                  field="lastRunAt"
                  active={sortBy}
                  order={order}
                  onSort={(field) =>
                    updateSort(field, sortBy, order, setSortBy, setOrder)
                  }
                />
                <SortableHeader
                  label="Next Run"
                  field="nextRunAt"
                  active={sortBy}
                  order={order}
                  onSort={(field) =>
                    updateSort(field, sortBy, order, setSortBy, setOrder)
                  }
                />
                <SortableHeader
                  label="Last Result"
                  field="lastResult"
                  active={sortBy}
                  order={order}
                  onSort={(field) =>
                    updateSort(field, sortBy, order, setSortBy, setOrder)
                  }
                />
                <Table.Th w={60} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {visibleTasks.map((task) => (
                <Table.Tr key={task.id}>
                  <Table.Td>
                    <Text fw={650}>{task.name}</Text>
                    <Text size="xs" c="dimmed">
                      {describeSchedule(task.schedule)} · {task.timeZone}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {taskConfigurationSummary(task)}
                    </Text>
                  </Table.Td>
                  <Table.Td>{task.serverName}</Table.Td>
                  <Table.Td>{taskTypeLabel(task.taskType)}</Table.Td>
                  <Table.Td>
                    <Badge
                      color={task.enabled ? "teal" : "gray"}
                      variant="light"
                    >
                      {task.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{formatDateTime(task.lastRunAt)}</Table.Td>
                  <Table.Td>{formatDateTime(task.nextRunAt)}</Table.Td>
                  <Table.Td>
                    <ResultBadge task={task} />
                  </Table.Td>
                  <Table.Td>
                    {isAdministrator && (
                      <Menu position="bottom-end" withinPortal>
                        <Menu.Target>
                          <ActionIcon
                            variant="subtle"
                            aria-label={`Actions for ${task.name}`}
                          >
                            <IconDots size={18} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<IconEdit size={16} />}
                            onClick={() => {
                              setEditing(task);
                              setDialogOpen(true);
                            }}
                          >
                            Edit
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<IconPower size={16} />}
                            onClick={() => void perform(task, "toggle")}
                          >
                            {task.enabled ? "Disable" : "Enable"}
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<IconPlayerPlay size={16} />}
                            onClick={() => void perform(task, "run")}
                          >
                            Run Now
                          </Menu.Item>
                          <Menu.Divider />
                          <Menu.Item
                            color="red"
                            leftSection={<IconTrash size={16} />}
                            onClick={() => void perform(task, "delete")}
                          >
                            Delete
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

        {tasks.length === 0 && (
          <Stack align="center" gap="xs" py={60} px="lg">
            <ThemeIcon size={52} radius="xl" variant="light" color="cyan">
              <IconClockPlay size={26} />
            </ThemeIcon>
            <Text fw={700}>No automation tasks found</Text>
            <Text c="dimmed" ta="center">
              {search || serverId || taskType || enabled
                ? "Try changing the search or filters."
                : "Create a scheduled server operation to get started."}
            </Text>
          </Stack>
        )}

        {tasks.length > pageSize && (
          <Group justify="flex-end" p="lg">
            <Pagination
              value={page}
              onChange={setPage}
              total={Math.ceil(tasks.length / pageSize)}
            />
          </Group>
        )}
      </Card>

      <AutomationTaskDialog
        opened={dialogOpen}
        servers={servers}
        task={editing}
        saving={saving}
        onClose={() => setDialogOpen(false)}
        onSave={save}
      />
    </Stack>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  color,
  compact = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  compact?: boolean;
}) {
  return (
    <Card className="pc-panel" withBorder radius="lg" p="lg">
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700} lts={1}>
            {label}
          </Text>
          <Text size={compact ? "sm" : "xl"} fw={750} mt={4}>
            {value}
          </Text>
        </div>
        <ThemeIcon color={color} variant="light" radius="xl" size="xl">
          {icon}
        </ThemeIcon>
      </Group>
    </Card>
  );
}

function SortableHeader({
  label,
  field,
  active,
  order,
  onSort,
}: {
  label: string;
  field: NonNullable<AutomationListQuery["sortBy"]>;
  active: NonNullable<AutomationListQuery["sortBy"]>;
  order: "asc" | "desc";
  onSort(field: NonNullable<AutomationListQuery["sortBy"]>): void;
}) {
  return (
    <Table.Th>
      <Button
        variant="subtle"
        color="gray"
        size="compact-sm"
        px={0}
        onClick={() => onSort(field)}
      >
        {label} {active === field ? (order === "asc" ? "↑" : "↓") : ""}
      </Button>
    </Table.Th>
  );
}

function ResultBadge({ task }: { task: AutomationTask }) {
  if (!task.lastResult) return <Text c="dimmed">Not run</Text>;
  return (
    <Badge
      color={
        task.lastResult === "success"
          ? "teal"
          : task.lastResult === "failure"
            ? "red"
            : "cyan"
      }
      variant="light"
      title={task.lastError ?? undefined}
    >
      {task.lastResult}
    </Badge>
  );
}

function updateSort(
  field: NonNullable<AutomationListQuery["sortBy"]>,
  current: NonNullable<AutomationListQuery["sortBy"]>,
  order: "asc" | "desc",
  setField: (value: NonNullable<AutomationListQuery["sortBy"]>) => void,
  setOrder: (value: "asc" | "desc") => void,
) {
  if (field === current) setOrder(order === "asc" ? "desc" : "asc");
  else {
    setField(field);
    setOrder("asc");
  }
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : "The request failed.";
}
