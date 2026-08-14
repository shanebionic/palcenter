"use client";

import {
  ActionIcon,
  AppShell,
  Burger,
  Group,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconAutomation,
  IconAdjustments,
  IconLayoutDashboard,
  IconMenu2,
  IconServer,
  IconTools,
} from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { getSession, type AuthSession } from "../lib/api";
import { AccountActions } from "./AccountActions";
import { Brand } from "./Brand";

interface ApplicationShellProps {
  children: ReactNode;
}

const NAVBAR_STORAGE_KEY = "pc-navbar-collapsed";
const NAVBAR_WIDTH_EXPANDED = 250;
const NAVBAR_WIDTH_COLLAPSED = 72;

const primaryLinks: Array<{
  href: string;
  label: string;
  icon: typeof IconLayoutDashboard;
  children?: Array<{ href: string; label: string }>;
}> = [
  { href: "/", label: "Dashboard", icon: IconLayoutDashboard },
  { href: "/servers", label: "Servers", icon: IconServer },
  { href: "/automation", label: "Automation", icon: IconAutomation },
  { href: "/tools", label: "Tools", icon: IconTools },
  { href: "/settings", label: "Settings", icon: IconAdjustments },
];

// SSR-safe synchronous localStorage read
// Canonical: true = collapsed, false = expanded
function getSavedCollapsed(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(NAVBAR_STORAGE_KEY) === "true";
}

export function ApplicationShell({ children }: ApplicationShellProps) {
  const [opened, navigation] = useDisclosure(false);
  // Single canonical boolean: collapsed
  const [collapsed, setCollapsed] = useState(getSavedCollapsed);
  const [session, setSession] = useState<AuthSession | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    void getSession()
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  const handleToggleDesktop = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(NAVBAR_STORAGE_KEY, String(next));
      } catch {
        // localStorage unavailable; persistence is optional
      }
      return next;
    });
  }, []);

  const navbarWidth = collapsed
    ? NAVBAR_WIDTH_COLLAPSED
    : NAVBAR_WIDTH_EXPANDED;

  const links = session?.user.mustChangePassword ? [] : primaryLinks;

  return (
    <AppShell
      header={{ height: 72 }}
      navbar={{
        width: navbarWidth,
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
        <AppShell.Section mb="md">
          <Group justify={collapsed ? "center" : "flex-end"} w="100%">
            <ActionIcon
              variant="subtle"
              aria-label={
                collapsed ? "Expand navigation" : "Collapse navigation"
              }
              onClick={handleToggleDesktop}
              visibleFrom="md"
            >
              <IconMenu2 size={18} />
            </ActionIcon>
          </Group>
        </AppShell.Section>

        <AppShell.Section component={ScrollArea} grow>
          <Stack gap={6}>
            {!collapsed && (
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
            )}
            {links.map(({ href, label, icon: Icon, children }) => {
              const isActive =
                href === "/" ? pathname === href : pathname.startsWith(href);
              const link = (
                <NavLink
                  key={href}
                  component={Link}
                  href={href}
                  label={collapsed ? undefined : label}
                  leftSection={<Icon size={19} stroke={1.8} />}
                  active={isActive}
                  defaultOpened={Boolean(children && pathname.startsWith(href))}
                >
                  {children?.map((child) => (
                    <NavLink
                      key={child.href}
                      component={Link}
                      href={child.href}
                      label={child.label}
                      active={pathname === child.href}
                    />
                  ))}
                </NavLink>
              );

              if (collapsed) {
                return (
                  <Tooltip
                    key={href}
                    label={label}
                    position="right"
                    withArrow
                    events={{ hover: true, focus: true, touch: false }}
                  >
                    {link}
                  </Tooltip>
                );
              }

              return link;
            })}
          </Stack>
        </AppShell.Section>

        <AppShell.Section>
          {!collapsed && (
            <Group gap="xs" p="sm" c="dimmed">
              <IconServer size={16} />
              <Text size="xs">Remote Palworld management</Text>
            </Group>
          )}
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <div className="pc-content">{children}</div>
      </AppShell.Main>
    </AppShell>
  );
}
