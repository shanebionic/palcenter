"use client";

import {
  AppShell,
  Burger,
  Group,
  NavLink,
  ScrollArea,
  Stack,
  Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconBell,
  IconDatabaseExport,
  IconLayoutDashboard,
  IconServer,
  IconUsers,
} from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { getSession, type AuthSession } from "../lib/api";
import { AccountActions } from "./AccountActions";
import { Brand } from "./Brand";

interface ApplicationShellProps {
  children: ReactNode;
}

const primaryLinks = [
  { href: "/", label: "Dashboard", icon: IconLayoutDashboard },
];

const adminLinks = [
  { href: "/users", label: "Users", icon: IconUsers },
  { href: "/notifications", label: "Notifications", icon: IconBell },
  { href: "/backup", label: "Backup & Restore", icon: IconDatabaseExport },
];

export function ApplicationShell({ children }: ApplicationShellProps) {
  const [opened, navigation] = useDisclosure(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    void getSession().then(setSession).catch(() => setSession(null));
  }, []);

  const links = session?.user.mustChangePassword
    ? []
    : session?.user.role === "administrator"
      ? [...primaryLinks, ...adminLinks]
      : primaryLinks;

  return (
    <AppShell
      header={{ height: 72 }}
      navbar={{
        width: 250,
        breakpoint: "md",
        collapsed: { mobile: !opened },
      }}
      padding={{ base: "md", sm: "xl" }}
    >
      <AppShell.Header className="pc-shell-header">
        <Group h="100%" px={{ base: "md", sm: "xl" }} justify="space-between">
          <Group gap="md">
            <Burger
              opened={opened}
              onClick={navigation.toggle}
              hiddenFrom="md"
              size="sm"
            />
            <Brand />
          </Group>
          <AccountActions />
        </Group>
      </AppShell.Header>

      <AppShell.Navbar className="pc-shell-navbar" p="md">
        <AppShell.Section component={ScrollArea} grow>
          <Stack gap={6}>
            <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={1.2} px="sm" py="xs">
              Command Center
            </Text>
            {links.map(({ href, label, icon: Icon }) => (
              <NavLink
                key={href}
                component={Link}
                href={href}
                label={label}
                leftSection={<Icon size={19} stroke={1.8} />}
                active={href === "/" ? pathname === href : pathname.startsWith(href)}
                onClick={navigation.close}
              />
            ))}
          </Stack>
        </AppShell.Section>
        <AppShell.Section>
          <Group gap="xs" p="sm" c="dimmed">
            <IconServer size={16} />
            <Text size="xs">Remote Palworld management</Text>
          </Group>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <div className="pc-content">{children}</div>
      </AppShell.Main>
    </AppShell>
  );
}
