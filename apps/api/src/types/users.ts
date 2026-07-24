export const userRoles = ["administrator", "moderator", "visitor"] as const;
export type UserRole = (typeof userRoles)[number];

export interface StoredUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  enabled: boolean;
  mustChangePassword: boolean;
  sessionVersion: number;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export type PublicUser = Omit<StoredUser, "passwordHash" | "sessionVersion">;

export interface NewUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  enabled: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserUpdate {
  username: string;
  email: string;
  role: UserRole;
  enabled: boolean;
  updatedAt: string;
}
