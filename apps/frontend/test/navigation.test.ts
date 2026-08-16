import assert from "node:assert/strict";
import test from "node:test";
import {
  detailBackTarget,
  normalizeInitialTab,
  type BackTarget,
} from "../lib/navigation";
import {
  baseMapDeepLinkHref,
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

test("map source produces ?tab=map recognized by ServerWorkspace", () => {
  const baseTarget = detailBackTarget("server-1", "base", "map");
  assert.equal(baseTarget.href, "/servers/server-1?tab=map");
  assert.equal(baseTarget.label, "Back to Map");

  const playerTarget = detailBackTarget("server-1", "player", "map");
  assert.equal(playerTarget.href, "/servers/server-1?tab=map");
  assert.equal(playerTarget.label, "Back to Map");

  const guildTarget = detailBackTarget("server-1", "guild", "map");
  assert.equal(guildTarget.href, "/servers/server-1?tab=map");
  assert.equal(guildTarget.label, "Back to Map");
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

test("normalizeInitialTab hides operated tabs from nonoperators", () => {
  const noPerms = { canOperate: false, canManage: false };
  for (const tab of [
    "players",
    "guilds",
    "bases",
    "map",
    "audit",
    "administration",
  ]) {
    assert.equal(
      normalizeInitialTab(tab, noPerms),
      "overview",
      `${tab} should be hidden from visitors`,
    );
  }
  assert.equal(normalizeInitialTab("connection", noPerms), "overview");
  assert.equal(normalizeInitialTab("overview", noPerms), "overview");
  assert.equal(normalizeInitialTab("settings", noPerms), "settings");
  assert.equal(normalizeInitialTab("monitoring", noPerms), "monitoring");
});

test("normalizeInitialTab preserves permitted tabs", () => {
  const full = { canOperate: true, canManage: true };
  for (const tab of [
    "players",
    "guilds",
    "bases",
    "map",
    "audit",
    "administration",
    "connection",
    "overview",
    "settings",
    "monitoring",
  ]) {
    assert.equal(
      normalizeInitialTab(tab, full),
      tab,
      `${tab} should be preserved for admins`,
    );
  }

  const operator = { canOperate: true, canManage: false };
  assert.equal(normalizeInitialTab("map", operator), "map");
  assert.equal(normalizeInitialTab("connection", operator), "overview");
});

test("baseMapDeepLinkHref carries serverId and baseId only", () => {
  const href = baseMapDeepLinkHref("srv-1", "Base-Camp_1");
  assert.equal(href, "/servers/srv-1?tab=map&base=Base-Camp_1");

  const parsed = new URL(href, "http://localhost");
  assert.equal(parsed.pathname, "/servers/srv-1");
  assert.equal(parsed.searchParams.get("tab"), "map");
  assert.equal(parsed.searchParams.get("base"), "Base-Camp_1");
  assert.equal(parsed.searchParams.has("x"), false);
  assert.equal(parsed.searchParams.has("y"), false);
  assert.equal(parsed.searchParams.has("z"), false);
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
