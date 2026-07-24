"use client";

import { Badge, Button, Group, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { getSession, logout, type AuthSession } from "../lib/api";

export function AccountActions() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    void getSession()
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  const signOut = async () => {
    setLoggingOut(true);

    try {
      await logout();
    } finally {
      window.location.replace("/login");
    }
  };

  return (
    <Group gap="sm">
      {session && (
        <>
          <Text size="sm" c="dimmed">
            {session.username}
          </Text>
          <Badge variant="light">{session.version}</Badge>
        </>
      )}
      <Button
        size="xs"
        variant="default"
        loading={loggingOut}
        onClick={() => void signOut()}
      >
        Log out
      </Button>
    </Group>
  );
}
