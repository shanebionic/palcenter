"use client";

import {
  Alert,
  Button,
  Card,
  Code,
  Group,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertCircle,
  IconClipboard,
  IconDownload,
} from "@tabler/icons-react";
import { useState } from "react";
import {
  copyConfigurationToClipboard,
  createConfigurationFile,
} from "../lib/config-generator/clipboard";

interface ConfigurationPreviewProps {
  exportContent: string | null;
  redactedContent: string | null;
  errorCount: number;
  hasSensitiveValues: boolean;
}

export function ConfigurationPreview({
  exportContent,
  redactedContent,
  errorCount,
  hasSensitiveValues,
}: ConfigurationPreviewProps) {
  const [showSensitiveValues, setShowSensitiveValues] = useState(false);
  const previewContent = showSensitiveValues ? exportContent : redactedContent;

  async function copyConfiguration() {
    if (!exportContent) return;
    try {
      await copyConfigurationToClipboard(
        exportContent,
        navigator.clipboard.writeText.bind(navigator.clipboard),
      );
      notifications.show({
        color: "cyan",
        title: "Configuration copied",
        message: "PalWorldSettings.ini is ready to paste.",
      });
    } catch {
      notifications.show({
        color: "red",
        title: "Copy failed",
        message:
          "The browser could not access the clipboard. Use Download instead.",
      });
    }
  }

  function downloadConfiguration() {
    if (!exportContent) return;
    const url = URL.createObjectURL(createConfigurationFile(exportContent));
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

        {hasSensitiveValues && (
          <Alert color="yellow" icon={<IconAlertCircle size={18} />}>
            Copy and Download include the configured passwords as plaintext.
            Store the resulting file securely.
          </Alert>
        )}

        <Switch
          label="Reveal sensitive values in preview"
          description="Passwords are hidden in the visual preview by default."
          checked={showSensitiveValues}
          onChange={(event) =>
            setShowSensitiveValues(event.currentTarget.checked)
          }
          disabled={!hasSensitiveValues || !exportContent}
        />

        <Code
          block
          aria-label="Generated PalWorldSettings.ini preview"
          className="pc-config-preview"
        >
          {previewContent ??
            "Configuration preview is unavailable while values are invalid."}
        </Code>

        <Group grow>
          <Button
            variant="light"
            leftSection={<IconClipboard size={18} />}
            onClick={() => void copyConfiguration()}
            disabled={!exportContent}
          >
            Copy
          </Button>
          <Button
            leftSection={<IconDownload size={18} />}
            onClick={downloadConfiguration}
            disabled={!exportContent}
          >
            Download
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
