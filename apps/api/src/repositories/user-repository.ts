import type { NewUser, StoredUser, UserUpdate } from "../types/users.js";

export interface UserRepository {
  initialize(): void;
  setupRequired(): boolean;
  createInitial(user: NewUser): StoredUser;
  list(): StoredUser[];
  get(id: string): StoredUser | null;
  findByUsername(username: string): StoredUser | null;
  create(user: NewUser): StoredUser;
  update(id: string, update: UserUpdate): StoredUser;
  updatePassword(
    id: string,
    passwordHash: string,
    mustChangePassword: boolean,
    updatedAt: string,
  ): StoredUser;
  recordLogin(id: string, loggedInAt: string): StoredUser;
  delete(id: string): void;
  check(): void;
  close(): void;
  reopen(): void;
}
