export const deleteBaseConfirmation = "DELETE";

export function canConfirmBaseDeletion(value: string): boolean {
  return value === deleteBaseConfirmation;
}
