"use client";

import { Badge, Button, Group } from "@mantine/core";
import Link from "next/link";
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
          <Button component={Link} href="/profile" size="xs" variant="subtle">
            {session.user.username}
          </Button>
          <Badge variant="light">{session.user.role}</Badge>
          <Badge variant="outline">{session.version}</Badge>
          {session.user.role === "administrator" && (
            <Button component={Link} href="/users" size="xs" variant="subtle">
              Users
            </Button>
          )}
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
