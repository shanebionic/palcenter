import { Card, type CardProps } from "@mantine/core";
import type { ReactNode } from "react";

interface SectionCardProps extends CardProps {
  children: ReactNode;
}

export function SectionCard({
  children,
  className,
  ...props
}: SectionCardProps) {
  return (
    <Card
      className={["pc-panel", className].filter(Boolean).join(" ")}
      withBorder
      radius="lg"
      p="lg"
      {...props}
    >
      {children}
    </Card>
  );
}
