export function broadcastCharacterCount(message: string): number {
  return [...message].length;
}

export function broadcastValidationError(message: string): string {
  return message.trim() ? "" : "Enter a message before sending the broadcast.";
}
