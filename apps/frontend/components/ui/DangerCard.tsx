import { Card, type CardProps } from "@mantine/core";
import type { ReactNode } from "react";

interface DangerCardProps extends CardProps {
  children: ReactNode;
}

export function DangerCard({ children, className, ...props }: DangerCardProps) {
  return (
    <Card
      className={["pc-panel", "pc-danger-card", className]
        .filter(Boolean)
        .join(" ")}
      withBorder
      radius="lg"
      p="lg"
      {...props}
    >
      {children}
    </Card>
  );
}
