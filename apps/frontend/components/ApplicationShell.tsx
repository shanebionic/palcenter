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
  IconAutomation,
  IconAdjustments,
  IconLayoutDashboard,
  IconShieldCheck,
  IconServer,
  IconTools,
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
  { href: "/servers", label: "Servers", icon: IconServer },
  { href: "/players", label: "Players", icon: IconUsers },
  { href: "/automation", label: "Automation", icon: IconAutomation },
  { href: "/tools", label: "Tools", icon: IconTools },
  {
    href: "/paldefender",
    label: "PalDefender",
    icon: IconShieldCheck,
    children: [
      { href: "/paldefender/status", label: "Status" },
      { href: "/paldefender/players", label: "Players" },
    ],
  },
  { href: "/settings", label: "Settings", icon: IconAdjustments },
];

export function ApplicationShell({ children }: ApplicationShellProps) {
  const [opened, navigation] = useDisclosure(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    void getSession()
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  const links = session?.user.mustChangePassword ? [] : primaryLinks;

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
              aria-label={opened ? "Close navigation" : "Open navigation"}
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
            <Text
              size="xs"
              tt="uppercase"
              c="dimmed"
              fw={700}
              lts={1.2}
              px="sm"
              py="xs"
            >
              Command Center
            </Text>
            {links.map(({ href, label, icon: Icon, children }) => (
              <NavLink
                key={href}
                component={Link}
                href={href}
                label={label}
                leftSection={<Icon size={19} stroke={1.8} />}
                active={
                  href === "/" ? pathname === href : pathname.startsWith(href)
                }
                onClick={navigation.close}
                defaultOpened={Boolean(children && pathname.startsWith(href))}
              >
                {children?.map((child) => (
                  <NavLink
                    key={child.href}
                    component={Link}
                    href={child.href}
                    label={child.label}
                    active={pathname === child.href}
                    onClick={navigation.close}
                  />
                ))}
              </NavLink>
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
