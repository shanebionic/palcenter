export interface PasswordProtectionPresentation {
  label: "Protected" | "Not protected" | "Unknown";
  showLock: boolean;
}

export function passwordProtectionPresentation(
  passwordProtected: boolean | null,
): PasswordProtectionPresentation {
  if (passwordProtected === null) {
    return { label: "Unknown", showLock: false };
  }

  return passwordProtected
    ? { label: "Protected", showLock: true }
    : { label: "Not protected", showLock: false };
}
