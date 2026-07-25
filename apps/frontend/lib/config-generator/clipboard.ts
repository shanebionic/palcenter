export type ClipboardWriter = (content: string) => Promise<void>;

export async function copyConfigurationToClipboard(
  content: string,
  writeText: ClipboardWriter,
): Promise<void> {
  await writeText(content);
}

export function createConfigurationFile(content: string): Blob {
  return new Blob([content], { type: "text/plain;charset=utf-8" });
}
