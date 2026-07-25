"use client";

import { Alert, Button, Card, Code, Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertCircle,
  IconClipboard,
  IconDownload,
} from "@tabler/icons-react";

interface ConfigurationPreviewProps {
  content: string | null;
  errorCount: number;
}

export function ConfigurationPreview({
  content,
  errorCount,
}: ConfigurationPreviewProps) {
  async function copyConfiguration() {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    notifications.show({
      color: "cyan",
      title: "Configuration copied",
      message: "PalWorldSettings.ini is ready to paste.",
    });
  }

  function downloadConfiguration() {
    if (!content) return;
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "PalWorldSettings.ini";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="pc-panel" p="lg" withBorder>
      <Stack gap="md">
        <Stack gap={4}>
          <Text fw={700} size="lg">
            Generated configuration
          </Text>
          <Text size="sm" c="dimmed">
            Preview only. PalCenter does not apply this file to a connected
            server.
          </Text>
        </Stack>

        {errorCount > 0 && (
          <Alert color="red" icon={<IconAlertCircle size={18} />}>
            Resolve {errorCount} validation{" "}
            {errorCount === 1 ? "error" : "errors"} to generate the file.
          </Alert>
        )}

        <Code
          block
          aria-label="Generated PalWorldSettings.ini preview"
          className="pc-config-preview"
        >
          {content ??
            "Configuration preview is unavailable while values are invalid."}
        </Code>

        <Group grow>
          <Button
            variant="light"
            leftSection={<IconClipboard size={18} />}
            onClick={() => void copyConfiguration()}
            disabled={!content}
          >
            Copy
          </Button>
          <Button
            leftSection={<IconDownload size={18} />}
            onClick={downloadConfiguration}
            disabled={!content}
          >
            Download
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
