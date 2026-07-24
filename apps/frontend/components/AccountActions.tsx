"use client";

import {
  Avatar,
  Badge,
  Group,
  Menu,
  Skeleton,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import {
  IconInfoCircle,
  IconChevronDown,
  IconLogout,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getSession, logout, type AuthSession } from "../lib/api";
import { AboutPalCenterModal } from "./AboutPalCenterModal";

function initials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

export function AccountActions() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [aboutOpened, setAboutOpened] = useState(false);

  useEffect(() => {
    void getSession().then(setSession).catch(() => setSession(null));
  }, []);

  const signOut = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      window.location.replace("/login");
    }
  };

  if (!session) {
    return <Skeleton width={164} height={42} radius="xl" />;
  }

  return (
    <>
      <Menu position="bottom-end" width={230} shadow="xl">
        <Menu.Target>
          <UnstyledButton
            aria-label="Open account menu"
            px="xs"
            py={5}
            style={{ borderRadius: "var(--mantine-radius-xl)" }}
          >
            <Group gap="sm" wrap="nowrap">
              <Avatar color="cyan" radius="xl">
                {initials(session.user.username)}
              </Avatar>
              <Stack gap={0} visibleFrom="sm">
                <Text size="sm" fw={650} lh={1.2}>
                  {session.user.username}
                </Text>
                <Text size="xs" c="dimmed" tt="capitalize">
                  {session.user.role}
                </Text>
              </Stack>
              <IconChevronDown size={16} />
            </Group>
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>
            <Group justify="space-between">
              Account
              <Badge size="xs" variant="light" tt="capitalize">
                {session.user.role}
              </Badge>
            </Group>
          </Menu.Label>
          <Menu.Item
            component={Link}
            href="/profile"
            leftSection={<IconUser size={16} />}
          >
            Profile
          </Menu.Item>
          {session.user.role === "administrator" && (
            <Menu.Item
              component={Link}
              href="/users"
              leftSection={<IconUsers size={16} />}
            >
              User Management
            </Menu.Item>
          )}
          <Menu.Item
            leftSection={<IconInfoCircle size={16} />}
            onClick={() => setAboutOpened(true)}
          >
            About PalCenter
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item
            color="red"
            leftSection={<IconLogout size={16} />}
            disabled={loggingOut}
            onClick={() => void signOut()}
          >
            {loggingOut ? "Signing out…" : "Logout"}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <AboutPalCenterModal
        opened={aboutOpened}
        onClose={() => setAboutOpened(false)}
        application={session.application}
      />
    </>
  );
}
