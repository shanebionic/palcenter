import { Card, SimpleGrid, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconFileSettings } from "@tabler/icons-react";
import Link from "next/link";
import { ApplicationShell } from "../../components/ApplicationShell";
import { PageHeader } from "../../components/PageHeader";
import styles from "./tools.module.css";

export default function ToolsPage() {
  return (
    <ApplicationShell>
      <Stack gap="xl">
        <PageHeader
          eyebrow="Utilities"
          title="Tools"
          description="Standalone utilities for Palworld server administrators. Tools do not change connected servers unless explicitly stated."
        />

        <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }}>
          <Link href="/tools/config-generator" className={styles.toolCard}>
            <Card
              className={`pc-panel ${styles.card}`}
              p="xl"
              withBorder
              h="100%"
            >
              <Stack gap="md">
                <ThemeIcon size={48} radius="md" variant="light">
                  <IconFileSettings size={26} />
                </ThemeIcon>
                <Stack gap={5}>
                  <Title order={2} size="h3">
                    Server Configuration Generator
                  </Title>
                  <Text c="dimmed">
                    Create and download a validated PalWorldSettings.ini file.
                  </Text>
                </Stack>
              </Stack>
            </Card>
          </Link>
        </SimpleGrid>
      </Stack>
    </ApplicationShell>
  );
}
