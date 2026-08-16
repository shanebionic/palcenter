import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ADMINISTRATOR_PERMISSIONS,
  MODERATOR_PERMISSIONS,
  VISITOR_PERMISSIONS,
  permissionsForRole,
} from "../src/services/paldefender-permissions.js";

test("visitor profile is exactly the read class", () => {
  assert.deepEqual(
    [...VISITOR_PERMISSIONS],
    [
      "REST.Banlist.Read",
      "REST.Guild.Read",
      "REST.Guilds.Read",
      "REST.Items.Read",
      "REST.Pals.Read",
      "REST.Player.Read",
      "REST.Players.Read",
      "REST.Progression.Read",
      "REST.Techs.Read",
    ],
  );
  assert.equal(VISITOR_PERMISSIONS.length, 9);
});

test("moderator profile is the read class plus every operate-class permission", () => {
  const visitor: readonly string[] = VISITOR_PERMISSIONS;
  const moderator: readonly string[] = MODERATOR_PERMISSIONS;
  assert.equal(moderator.length, 29);
  for (const permission of visitor) {
    assert.ok(
      moderator.includes(permission),
      `moderator must include ${permission}`,
    );
  }
  for (const permission of [
    "REST.Items.Give",
    "REST.Messages.Alert",
    "REST.Messages.Broadcast",
    "REST.Messages.Send.GlobalChat",
    "REST.Messages.Send.GuildChat",
    "REST.Messages.Send.Log.Important",
    "REST.Messages.Send.Log.Normal",
    "REST.Messages.Send.Log.VeryImportant",
    "REST.Messages.Send.PlayerChat",
    "REST.Pals.Give",
    "REST.PalEggs.Give",
    "REST.PalTemplates.Give",
    "REST.Progression.Give",
    "REST.Punishments.Ban",
    "REST.Punishments.BanIP",
    "REST.Punishments.Kick",
    "REST.Punishments.Unban",
    "REST.Punishments.UnbanIP",
    "REST.Techs.Forget",
    "REST.Techs.Learn",
  ]) {
    assert.ok(
      moderator.includes(permission),
      `moderator must include ${permission}`,
    );
  }
});

test("administrator profile adds only the manage-servers PalDefender permissions", () => {
  assert.equal(ADMINISTRATOR_PERMISSIONS.length, 31);
  assert.ok(ADMINISTRATOR_PERMISSIONS.includes("REST.Base.Delete"));
  assert.ok(ADMINISTRATOR_PERMISSIONS.includes("REST.Reload.Config"));
  for (const permission of MODERATOR_PERMISSIONS) {
    assert.ok(
      ADMINISTRATOR_PERMISSIONS.includes(permission),
      `administrator must include ${permission}`,
    );
  }
});

test("profiles are strict supersets and contain no wildcard or version read", () => {
  const roles = ["visitor", "moderator", "administrator"] as const;
  for (const role of roles) {
    const permissions = permissionsForRole(role);
    assert.ok(!permissions.includes("REST.*"), `${role} must not use REST.*`);
    assert.ok(
      !permissions.includes("REST.Version.Read"),
      `${role} must not include REST.Version.Read`,
    );
    assert.equal(
      new Set(permissions).size,
      permissions.length,
      `${role} must not repeat permissions`,
    );
  }
  for (let i = 0; i + 1 < roles.length; i++) {
    const lower = new Set(permissionsForRole(roles[i]));
    const upper = new Set(permissionsForRole(roles[i + 1]));
    for (const permission of lower) {
      assert.ok(upper.has(permission), "profiles must be strict supersets");
    }
  }
});

test("ban permission traceability: Ban and BanIP both come from the operate ban route", () => {
  // The ban route's optional IP flag requires Punishments.BanIP in addition
  // to Punishments.Ban, so both must be present for every role that can ban.
  const visitor: readonly string[] = VISITOR_PERMISSIONS;
  const moderator: readonly string[] = MODERATOR_PERMISSIONS;
  assert.ok(moderator.includes("REST.Punishments.Ban"));
  assert.ok(moderator.includes("REST.Punishments.BanIP"));
  assert.ok(!visitor.includes("REST.Punishments.Ban"));
  assert.ok(!visitor.includes("REST.Punishments.BanIP"));
});
