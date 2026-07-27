export type BuildChannel = "production" | "development";

export interface BuildChannelPresentation {
  label: "Production Build" | "Development Build";
  color: "blue" | "orange";
  showCommit: boolean;
}

export function buildChannelPresentation(
  channel: BuildChannel,
): BuildChannelPresentation {
  return channel === "production"
    ? { label: "Production Build", color: "blue", showCommit: false }
    : { label: "Development Build", color: "orange", showCommit: true };
}
