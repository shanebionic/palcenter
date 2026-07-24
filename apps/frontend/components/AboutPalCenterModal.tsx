"use client";

import {
  Anchor,
  Badge,
  Divider,
  Group,
  Image,
  Modal,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import {
  IconBook2,
  IconBrandGithub,
  IconBug,
  IconScale,
} from "@tabler/icons-react";

interface AboutPalCenterModalProps {
  opened: boolean;
  onClose: () => void;
  application: {
    name: string;
    description: string;
    version: string;
    releaseChannel: string;
    deployment: string;
  };
}

const repositoryUrl = "https://github.com/shanebionic/palcenter";

function ExternalLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Anchor href={href} target="_blank" rel="noopener noreferrer" c="gray.2">
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon variant="light" color="cyan" radius="md">
          {icon}
        </ThemeIcon>
        <Text size="sm">{children}</Text>
      </Group>
    </Anchor>
  );
}

export function AboutPalCenterModal({
  opened,
  onClose,
  application,
}: AboutPalCenterModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="About PalCenter"
      centered
      size="md"
      classNames={{ content: "pc-panel" }}
    >
      <Stack gap="lg">
        <Stack align="center" gap="xs">
          <Image
            src="/assets/palcenter-logo.png"
            alt="PalCenter"
            w={88}
            h={88}
            radius="xl"
          />
          <Text fw={800} size="xl" c="gray.0">
            {application.name}
          </Text>
          <Text size="sm" c="dimmed">
            {application.description}
          </Text>
          <Badge color="cyan" variant="light">
            {application.version.startsWith("v")
              ? application.version
              : `v${application.version}`}
          </Badge>
          <Group gap="xs" justify="center">
            <Badge color="blue" variant="dot">
              {application.releaseChannel}
            </Badge>
            <Badge color="gray" variant="dot">
              Deployment: {application.deployment}
            </Badge>
          </Group>
        </Stack>

        <Divider />

        <Stack gap="md">
          <ExternalLink
            href={repositoryUrl}
            icon={<IconBrandGithub size={18} />}
          >
            GitHub Repository
          </ExternalLink>
          <ExternalLink
            href={`${repositoryUrl}/wiki`}
            icon={<IconBook2 size={18} />}
          >
            Documentation & Wiki
          </ExternalLink>
          <ExternalLink
            href={`${repositoryUrl}/issues`}
            icon={<IconBug size={18} />}
          >
            Issue Tracker
          </ExternalLink>
        </Stack>

        <Divider />

        <Group gap="sm" wrap="nowrap" align="flex-start">
          <ThemeIcon variant="light" color="cyan" radius="md">
            <IconScale size={18} />
          </ThemeIcon>
          <Stack gap={2}>
            <Text size="sm" fw={600}>
              MIT License
            </Text>
            <Text size="xs" c="dimmed">
              PalCenter is open-source software licensed under the MIT License.
            </Text>
          </Stack>
        </Group>
      </Stack>
    </Modal>
  );
}
