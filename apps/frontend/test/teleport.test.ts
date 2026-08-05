import assert from "node:assert/strict";
import test from "node:test";
import { supportsMapTeleport } from "../lib/teleport";
import type { CompanionStatus } from "../types/companion";

test("requires the Companion safe-height map teleport capability", () => {
  const supported = {
    state: "connected",
    capabilities: { adminActions: { supported: true, capabilityVersion: "2" } },
    adminActions: { teleportPlayerToLocation: true },
  };
  const olderContract = {
    ...supported,
    capabilities: { adminActions: { supported: true, capabilityVersion: "1" } },
  };
  const disabledAction = {
    ...supported,
    adminActions: { teleportPlayerToLocation: false },
  };

  assert.equal(
    supportsMapTeleport(supported as unknown as CompanionStatus),
    true,
  );
  assert.equal(
    supportsMapTeleport(olderContract as unknown as CompanionStatus),
    false,
  );
  assert.equal(
    supportsMapTeleport(disabledAction as unknown as CompanionStatus),
    false,
  );
});
