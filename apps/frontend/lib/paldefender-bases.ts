export const deleteBaseConfirmation = "DELETE";
export const deleteBaseWarning =
  "The selected base, its Palbox, assigned worker Pals, structures, storage, and other camp data will be permanently deleted. Worker Pals are not returned to the owner's Palbox.";

export function canConfirmBaseDeletion(value: string): boolean {
  return value === deleteBaseConfirmation;
}
