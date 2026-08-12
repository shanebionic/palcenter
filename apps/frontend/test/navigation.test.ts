import assert from "node:assert/strict";
import test from "node:test";
import { detailBackTarget, type BackTarget } from "../lib/navigation";
import {
  isDetailSource,
  palDefenderBaseHref,
  palDefenderGuildHref,
  palDefenderPlayerHref,
} from "../lib/paldefender";

test("detailBackTarget returns correct server workspace target for each source", () => {
  assertBackTarget("base", "map", {
    href: "/servers/server-1?tab=map",
    label: "Back to Map",
  });
  assertBackTarget("base", "bases", {
    href: "/servers/server-1?tab=bases",
    label: "Back to Bases",
  });
  assertBackTarget("player", "players", {
    href: "/servers/server-1?tab=players",
    label: "Back to Players",
  });
  assertBackTarget("guild", "guilds", {
    href: "/servers/server-1?tab=guilds",
    label: "Back to Guilds",
  });
});

test("detailBackTarget returns correct PalDefender list target", () => {
  assertBackTarget("base", "paldefender-bases", {
    href: "/paldefender/bases?serverId=server-1",
    label: "Back to Bases",
  });
  assertBackTarget("player", "paldefender-players", {
    href: "/paldefender/players?serverId=server-1",
    label: "Back to Players",
  });
  assertBackTarget("guild", "paldefender-guilds", {
    href: "/paldefender/guilds?serverId=server-1",
    label: "Back to Guilds",
  });
});

test("detailBackTarget falls back to resource-specific default when no source", () => {
  assertBackTarget("base", null, {
    href: "/servers/server-1?tab=bases",
    label: "Back to Bases",
  });
  assertBackTarget("player", null, {
    href: "/servers/server-1?tab=players",
    label: "Back to Players",
  });
  assertBackTarget("guild", null, {
    href: "/servers/server-1?tab=guilds",
    label: "Back to Guilds",
  });
});

test("detailBackTarget rejects arbitrary return values and falls back safely", () => {
  assertBackTarget("base", "https://evil.com", {
    href: "/servers/server-1?tab=bases",
    label: "Back to Bases",
  });
  assertBackTarget("base", "//evil.com", {
    href: "/servers/server-1?tab=bases",
    label: "Back to Bases",
  });
  assertBackTarget("base", "javascript:alert(1)", {
    href: "/servers/server-1?tab=bases",
    label: "Back to Bases",
  });
  assertBackTarget("base", "custom-thing", {
    href: "/servers/server-1?tab=bases",
    label: "Back to Bases",
  });
  assertBackTarget("base", "", {
    href: "/servers/server-1?tab=bases",
    label: "Back to Bases",
  });
});

test("detailBackTarget encodes server ID in return URLs", () => {
  const target = detailBackTarget("server/1", "base", "map");
  assert.equal(target.href, "/servers/server%2F1?tab=map");
  assert.equal(target.label, "Back to Map");

  const pdTarget = detailBackTarget("server/1", "base", "paldefender-bases");
  assert.equal(pdTarget.href, "/paldefender/bases?serverId=server%2F1");
  assert.equal(pdTarget.label, "Back to Bases");
});

test("isDetailSource validates the allowlist", () => {
  assert.equal(isDetailSource("map"), true);
  assert.equal(isDetailSource("bases"), true);
  assert.equal(isDetailSource("players"), true);
  assert.equal(isDetailSource("guilds"), true);
  assert.equal(isDetailSource("paldefender-bases"), true);
  assert.equal(isDetailSource("paldefender-players"), true);
  assert.equal(isDetailSource("paldefender-guilds"), true);
  assert.equal(isDetailSource("custom"), false);
  assert.equal(isDetailSource("https://evil.com"), false);
  assert.equal(isDetailSource(""), false);
});

test("palDefender*Href helpers produce correct return query string", () => {
  assert.equal(
    palDefenderBaseHref("server-1", "base-1", "map"),
    "/servers/server-1/bases/base-1?from=map",
  );
  assert.equal(
    palDefenderBaseHref("server-1", "base-1", "bases"),
    "/servers/server-1/bases/base-1?from=bases",
  );
  assert.equal(
    palDefenderPlayerHref("server-1", "player-1", "players"),
    "/servers/server-1/players/player-1?from=players",
  );
  assert.equal(
    palDefenderGuildHref("server-1", "guild-1", "paldefender-guilds"),
    "/servers/server-1/guilds/guild-1?from=paldefender-guilds",
  );
});

test("palDefender*Href helpers omit query string when no source", () => {
  assert.equal(
    palDefenderBaseHref("server-1", "base-1"),
    "/servers/server-1/bases/base-1",
  );
  assert.equal(
    palDefenderPlayerHref("server-1", "player-1"),
    "/servers/server-1/players/player-1",
  );
  assert.equal(
    palDefenderGuildHref("server-1", "guild-1"),
    "/servers/server-1/guilds/guild-1",
  );
});

function assertBackTarget(
  resource: "base" | "player" | "guild",
  from: string | null,
  expected: BackTarget,
) {
  assert.deepEqual(
    detailBackTarget("server-1", resource, from),
    expected,
    `${resource} / ${from}`,
  );
}
