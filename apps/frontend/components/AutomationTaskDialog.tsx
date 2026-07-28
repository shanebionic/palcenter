"use client";

import {
  Button,
  Card,
  Group,
  Loader,
  Modal,
  NumberInput,
  Select,
  Stack,
  Stepper,
  Switch,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { previewAutomationSchedule } from "../lib/api";
import {
  formatSchedulePreviewDate,
  intervalScheduleDescription,
} from "../lib/automation";
import type { PublicConnection } from "../types/servers";
import type {
  AutomationSchedule,
  AutomationTask,
  AutomationTaskInput,
} from "../types/automation";

interface AutomationTaskDialogProps {
  opened: boolean;
  servers: PublicConnection[];
  task: AutomationTask | null;
  saving: boolean;
  onClose(): void;
  onSave(input: AutomationTaskInput): Promise<void>;
}

const scheduleOptions = [
  { value: "every_minutes", label: "Every N minutes" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "specific_time", label: "Specific time" },
  { value: "cron", label: "Advanced (cron)" },
];

const defaultSchedule: AutomationSchedule = {
  type: "every_minutes",
  interval: 30,
  startMinute: 0,
};

function scheduleFor(type: AutomationSchedule["type"]): AutomationSchedule {
  switch (type) {
    case "every_minutes":
      return defaultSchedule;
    case "hourly":
      return { type, minute: 0 };
    case "daily":
      return { type, time: "09:00" };
    case "weekly":
      return { type, dayOfWeek: 1, time: "09:00" };
    case "monthly":
      return { type, dayOfMonth: 1, time: "09:00" };
    case "specific_time":
      return { type, runAt: new Date(Date.now() + 3_600_000).toISOString() };
    case "cron":
      return { type, expression: "0 9 * * *" };
  }
}

export function AutomationTaskDialog({
  opened,
  servers,
  task,
  saving,
  onClose,
  onSave,
}: AutomationTaskDialogProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [serverId, setServerId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [timeZone, setTimeZone] = useState("UTC");
  const [schedule, setSchedule] = useState<AutomationSchedule>(defaultSchedule);

  useEffect(() => {
    if (!opened) return;
    setStep(task ? 2 : 0);
    setName(task?.name ?? "");
    setServerId(task?.serverId ?? servers[0]?.id ?? null);
    setMessage(task?.configuration.message ?? "");
    setEnabled(task?.enabled ?? true);
    setTimeZone(
      task?.timeZone ??
        Intl.DateTimeFormat().resolvedOptions().timeZone ??
        "UTC",
    );
    setSchedule(task?.schedule ?? defaultSchedule);
  }, [opened, servers, task]);

  const submit = () => {
    if (!serverId) return;
    void onSave({
      name,
      serverId,
      enabled,
      taskType: "broadcast_message",
      schedule,
      timeZone,
      configuration: { message },
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={task ? "Edit automation task" : "Create automation task"}
      size="lg"
      centered
    >
      <Stepper active={step} mb="xl" size="sm">
        <Stepper.Step label="Server" />
        <Stepper.Step label="Task type" />
        <Stepper.Step label="Configure" />
      </Stepper>

      {step === 0 && (
        <Stack>
          <Select
            label="Palworld server"
            description="Choose which configured server will run this task."
            placeholder="Select a server"
            data={servers.map((server) => ({
              value: server.id,
              label: server.name,
            }))}
            value={serverId}
            onChange={setServerId}
            searchable
            required
          />
          <Group justify="flex-end">
            <Button disabled={!serverId} onClick={() => setStep(1)}>
              Continue
            </Button>
          </Group>
        </Stack>
      )}

      {step === 1 && (
        <Stack>
          <Select
            label="Task type"
            data={[
              {
                value: "broadcast_message",
                label: "Broadcast Message",
              },
            ]}
            value="broadcast_message"
            readOnly
          />
          <Text size="sm" c="dimmed">
            Send a message to every player currently connected to the selected
            server.
          </Text>
          <Group justify="space-between">
            <Button variant="default" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button onClick={() => setStep(2)}>Continue</Button>
          </Group>
        </Stack>
      )}

      {step === 2 && (
        <Stack>
          <TextInput
            label="Task name"
            placeholder="Daily restart reminder"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            maxLength={100}
            required
          />
          <Textarea
            label="Broadcast message"
            placeholder="Server restart begins in 15 minutes."
            value={message}
            onChange={(event) => setMessage(event.currentTarget.value)}
            minRows={3}
            maxLength={500}
            required
          />
          <Select
            label="Schedule"
            data={scheduleOptions}
            value={schedule.type}
            onChange={(value) =>
              setSchedule(
                scheduleFor(
                  (value ?? "every_minutes") as AutomationSchedule["type"],
                ),
              )
            }
          />
          <ScheduleEditor
            schedule={schedule}
            timeZone={timeZone}
            onChange={setSchedule}
          />
          <TextInput
            label="Time zone"
            description="Use an IANA zone such as America/New_York."
            value={timeZone}
            onChange={(event) => setTimeZone(event.currentTarget.value)}
            required
          />
          <Switch
            label="Task enabled"
            checked={enabled}
            onChange={(event) => setEnabled(event.currentTarget.checked)}
          />
          <Group justify="space-between">
            <Button variant="default" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              loading={saving}
              disabled={!name.trim() || !message.trim() || !timeZone.trim()}
              onClick={submit}
            >
              {task ? "Save changes" : "Create task"}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

function ScheduleEditor({
  schedule,
  timeZone,
  onChange,
}: {
  schedule: AutomationSchedule;
  timeZone: string;
  onChange(value: AutomationSchedule): void;
}) {
  switch (schedule.type) {
    case "every_minutes":
      return (
        <IntervalScheduleEditor
          schedule={schedule}
          timeZone={timeZone}
          onChange={onChange}
        />
      );
    case "hourly":
      return (
        <NumberInput
          label="Minute past the hour"
          min={0}
          max={59}
          value={schedule.minute}
          onChange={(value) =>
            onChange({ ...schedule, minute: Number(value) || 0 })
          }
        />
      );
    case "daily":
      return (
        <TextInput
          type="time"
          label="Time"
          value={schedule.time}
          onChange={(event) =>
            onChange({ ...schedule, time: event.currentTarget.value })
          }
        />
      );
    case "weekly":
      return (
        <Group grow align="flex-start">
          <Select
            label="Day"
            data={[
              "Sunday",
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
            ].map((label, value) => ({ label, value: String(value) }))}
            value={String(schedule.dayOfWeek)}
            onChange={(value) =>
              onChange({ ...schedule, dayOfWeek: Number(value) })
            }
          />
          <TextInput
            type="time"
            label="Time"
            value={schedule.time}
            onChange={(event) =>
              onChange({ ...schedule, time: event.currentTarget.value })
            }
          />
        </Group>
      );
    case "monthly":
      return (
        <Group grow align="flex-start">
          <NumberInput
            label="Day of month"
            min={1}
            max={31}
            value={schedule.dayOfMonth}
            onChange={(value) =>
              onChange({ ...schedule, dayOfMonth: Number(value) || 1 })
            }
          />
          <TextInput
            type="time"
            label="Time"
            value={schedule.time}
            onChange={(event) =>
              onChange({ ...schedule, time: event.currentTarget.value })
            }
          />
        </Group>
      );
    case "specific_time":
      return (
        <TextInput
          type="datetime-local"
          label="Run once at"
          value={schedule.runAt.slice(0, 16)}
          onChange={(event) => {
            const value = event.currentTarget.value;
            if (value)
              onChange({ ...schedule, runAt: new Date(value).toISOString() });
          }}
        />
      );
    case "cron":
      return (
        <TextInput
          label="Cron expression"
          description="Five fields: minute, hour, day of month, month, day of week."
          placeholder="0 9 * * *"
          value={schedule.expression}
          onChange={(event) =>
            onChange({ ...schedule, expression: event.currentTarget.value })
          }
        />
      );
  }
}

function IntervalScheduleEditor({
  schedule,
  timeZone,
  onChange,
}: {
  schedule: Extract<AutomationSchedule, { type: "every_minutes" }>;
  timeZone: string;
  onChange(value: AutomationSchedule): void;
}) {
  const [nextRunAt, setNextRunAt] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (
      schedule.interval < 1 ||
      schedule.startMinute < 0 ||
      schedule.startMinute >= schedule.interval ||
      !timeZone.trim()
    ) {
      setNextRunAt(null);
      setPreviewError("Enter a valid interval, start minute, and time zone.");
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(() => {
      setLoading(true);
      void previewAutomationSchedule(schedule, timeZone)
        .then((preview) => {
          if (cancelled) return;
          setNextRunAt(preview.nextRunAt);
          setPreviewError(null);
        })
        .catch((error) => {
          if (cancelled) return;
          setNextRunAt(null);
          setPreviewError(
            error instanceof Error
              ? error.message
              : "Unable to calculate the next run.",
          );
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [schedule, timeZone]);

  return (
    <Stack gap="sm">
      <Group grow align="flex-start">
        <NumberInput
          label="Interval (minutes)"
          min={1}
          max={10_080}
          value={schedule.interval}
          onChange={(value) => {
            const interval = Math.max(1, Number(value) || 1);
            onChange({
              ...schedule,
              interval,
              startMinute: Math.min(schedule.startMinute, interval - 1),
            });
          }}
        />
        <NumberInput
          label="Start minute"
          description={`Allowed range: 0–${schedule.interval - 1}`}
          min={0}
          max={schedule.interval - 1}
          value={schedule.startMinute}
          onChange={(value) =>
            onChange({
              ...schedule,
              startMinute: Math.min(
                schedule.interval - 1,
                Math.max(0, Number(value) || 0),
              ),
            })
          }
        />
      </Group>

      <Card withBorder radius="md" p="md" bg="dark.7">
        <Stack gap={6}>
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm" fw={650}>
              Schedule preview
            </Text>
            {loading && <Loader size="xs" />}
          </Group>
          <Text size="sm" c="dimmed">
            {intervalScheduleDescription(
              schedule.interval,
              schedule.startMinute,
            )}
          </Text>
          <div>
            <Text size="xs" tt="uppercase" fw={700} c="dimmed">
              Next run
            </Text>
            <Text size="sm" c={previewError ? "red.4" : undefined}>
              {previewError
                ? previewError
                : nextRunAt
                  ? formatSchedulePreviewDate(nextRunAt, timeZone)
                  : "Calculating…"}
            </Text>
          </div>
        </Stack>
      </Card>
    </Stack>
  );
}
