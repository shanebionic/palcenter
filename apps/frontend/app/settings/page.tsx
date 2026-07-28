"use client";

import { Button, Card, SimpleGrid, Stack, Text } from "@mantine/core";
import {
  IconBell,
  IconDatabaseExport,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ApplicationShell } from "../../components/ApplicationShell";
import { PageHeader } from "../../components/PageHeader";
import { getSession } from "../../lib/api";

const administratorSettings = [
  {
    href: "/users",
    title: "User Management",
    description: "Manage accounts, roles, and access.",
    icon: IconUsers,
  },
  {
    href: "/notifications",
    title: "Notifications",
    description: "Configure Discord and ntfy providers.",
    icon: IconBell,
  },
  {
    href: "/backup",
    title: "Backup & Restore",
    description: "Export or recover PalCenter data.",
    icon: IconDatabaseExport,
  },
];

export default function SettingsPage() {
  const [administrator, setAdministrator] = useState(false);

  useEffect(() => {
    void getSession().then((session) =>
      setAdministrator(session.user.role === "administrator"),
    );
  }, []);

  const settings = [
    {
      href: "/profile",
      title: "Profile",
      description: "Review your account and change your password.",
      icon: IconUser,
    },
    ...(administrator ? administratorSettings : []),
  ];

  return (
    <ApplicationShell>
      <Stack gap="xl">
        <PageHeader
          eyebrow="Command Center"
          title="Settings"
          description="Manage your account and PalCenter administration settings."
        />
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          {settings.map(({ href, title, description, icon: Icon }) => (
            <Card key={href} className="pc-panel" withBorder radius="lg" p="xl">
              <Stack align="flex-start">
                <Icon size={26} color="var(--mantine-color-cyan-4)" />
                <div>
                  <Text fw={700} size="lg">
                    {title}
                  </Text>
                  <Text c="dimmed" size="sm">
                    {description}
                  </Text>
                </div>
                <Button component={Link} href={href} variant="light">
                  Open
                </Button>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      </Stack>
    </ApplicationShell>
  );
}
