import { expect, test, type Page } from "@playwright/test";

async function setPlayerMode(
  page: Page,
  mode:
    | "empty"
    | "error"
    | "populated"
    | "unknown"
    | "instance"
    | "world-tree"
    | "stale",
): Promise<void> {
  const response = await page.request.get(
    `http://127.0.0.1:3198/__test/players?mode=${mode}`,
  );
  expect(response.ok()).toBe(true);
}

async function setSessionRole(
  page: Page,
  role: "administrator" | "moderator" | "visitor",
): Promise<void> {
  const response = await page.request.get(
    `http://127.0.0.1:3198/__test/role?role=${role}`,
  );
  expect(response.ok()).toBe(true);
}

async function setPalDefenderMode(
  page: Page,
  mode: "connected" | "disabled" | "unreachable" | "authentication_failed",
) {
  const response = await page.request.get(
    `http://127.0.0.1:3198/__test/paldefender?mode=${mode}`,
  );
  expect(response.ok()).toBe(true);
}

async function resetBroadcasts(page: Page) {
  await page.request.get("http://127.0.0.1:3198/__test/broadcasts?reset=true");
}

async function recordedBroadcasts(page: Page) {
  const response = await page.request.get(
    "http://127.0.0.1:3198/__test/broadcasts",
  );
  return (await response.json()) as {
    broadcasts: Array<{ serverId: string; provider: string }>;
  };
}

test("normal Players progressively exposes enhanced player management", async ({
  page,
}) => {
  await setPalDefenderMode(page, "connected");
  await page.goto("/servers/srv-test/players");
  await expect(page).toHaveURL(/\/servers\/srv-test\?tab=players$/);
  await expect(
    page.getByRole("heading", { name: "Palpagos Test Server" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Denalb" })).toHaveCount(1);
  await expect(page.getByText("Pal Tamers")).toBeVisible();
  await page.getByRole("link", { name: "Denalb" }).click();
  await expect(page).toHaveURL(/\/servers\/srv-test\/players\//);
  await expect(page.getByText("Player Workspace")).toBeVisible();
  const overview = page.getByRole("tabpanel", { name: "Overview" });
  await expect(overview.getByText("Level")).toBeVisible();
  await expect(overview.getByText("6", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to Players" }).click();
  await expect(page).toHaveURL(/\/servers\/srv-test\?tab=players$/);
  await expect(page.getByRole("tab", { name: "Players" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByText("View and manage players.")).toBeVisible();
  await page.getByRole("link", { name: "Denalb" }).click();
  for (const tab of [
    "Inventory",
    "Pals",
    "Technology",
    "Progression",
    "Actions",
  ]) {
    await expect(page.getByRole("tab", { name: tab })).toBeVisible();
  }
  await page.getByRole("tab", { name: "Inventory" }).click();
  await expect(
    page.getByRole("tabpanel", { name: "Inventory" }).getByText("Wood"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Give Item" })).toBeVisible();
  await page.getByRole("button", { name: "Give Item" }).click();
  const itemGrant = page.getByRole("dialog", { name: "Give Item" });
  await itemGrant.getByRole("combobox", { name: "Item" }).fill("ultimate");
  await page.getByRole("option", { name: /Ultimate Sphere/ }).click();
  await itemGrant.getByRole("button", { name: "Review Grant" }).click();
  const itemConfirmation = page.getByRole("dialog", {
    name: "Confirm Item Grant",
  });
  await expect(itemConfirmation.getByText("PalSphere_Ultimate")).toBeVisible();
  await itemConfirmation.getByRole("button", { name: "Give Item" }).click();
  await expect(page.getByText("Item granted")).toBeVisible();
  await page.getByRole("tab", { name: "Pals" }).click();
  for (const action of ["Give Pal", "Give Pal from Template", "Give Pal Egg"]) {
    await expect(
      page.getByRole("button", { name: action, exact: true }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Give Pal", exact: true }).click();
  const palGrant = page.getByRole("dialog", { name: "Give Pal", exact: true });
  await palGrant.getByRole("combobox", { name: "Pal" }).fill("lamball");
  await page.getByRole("option", { name: /Lamball/ }).click();
  await palGrant.getByRole("button", { name: "Review Grant" }).click();
  const palConfirmation = page.getByRole("dialog", {
    name: "Confirm Pal Grant",
  });
  await expect(palConfirmation.getByText("Pal ID: SheepBall")).toBeVisible();
  await palConfirmation.getByRole("button", { name: "Give Pal" }).click();
  await expect(page.getByText("Pal granted")).toBeVisible();
  await page
    .getByRole("button", { name: "Give Pal from Template", exact: true })
    .click();
  const templateGrant = page.getByRole("dialog", {
    name: "Give Pal from Template",
  });
  await templateGrant
    .getByLabel("Template filename")
    .fill("starter_pengullet.json");
  await templateGrant.getByRole("button", { name: "Review Grant" }).click();
  const templateConfirmation = page.getByRole("dialog", {
    name: "Confirm Template Pal Grant",
  });
  await expect(
    templateConfirmation.getByText("starter_pengullet.json"),
  ).toBeVisible();
  await templateConfirmation
    .getByRole("button", { name: "Give Template Pal" })
    .click();
  await expect(page.getByText("Template Pal granted")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pengullet" })).toBeVisible();

  await page.getByRole("button", { name: "Give Pal Egg", exact: true }).click();
  const eggGrant = page.getByRole("dialog", { name: "Give Pal Egg" });
  await eggGrant
    .getByRole("combobox", { name: "Egg", exact: true })
    .fill("common egg");
  await page
    .getByRole("option", { name: "Common Egg PalEgg_Normal_01" })
    .click();
  await eggGrant
    .getByRole("combobox", { name: "Pal inside egg" })
    .fill("foxparks");
  await page.getByRole("option", { name: "Foxparks Kitsunebi" }).click();
  await eggGrant.getByLabel("Level (optional)").fill("1");
  await eggGrant.getByRole("button", { name: "Review Grant" }).click();
  const eggConfirmation = page.getByRole("dialog", {
    name: "Confirm Pal Egg Grant",
  });
  await expect(
    eggConfirmation.getByText("Egg ID: PalEgg_Normal_01"),
  ).toBeVisible();
  await expect(eggConfirmation.getByText("Pal ID: Kitsunebi")).toBeVisible();
  await eggConfirmation.getByRole("button", { name: "Give Pal Egg" }).click();
  await expect(page.getByText("Pal egg granted")).toBeVisible();
  await page.screenshot({
    path: "../../docs/screenshots/pal-provisioning.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Technology" }).click();
  await expect(page.getByText("Arrow")).toBeVisible();
  await page.getByRole("button", { name: "Learn Technology" }).click();
  await page
    .getByRole("combobox", { name: "Technologies" })
    .fill("primitive workbench");
  await page.getByRole("option", { name: /Primitive Workbench/ }).click();
  await page.getByRole("combobox", { name: "Technologies" }).press("Escape");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("1 selected technology")).toBeVisible();
  const learnConfirmation = page.getByRole("dialog", {
    name: "Confirm Learn Technology",
  });
  await expect(learnConfirmation.getByText("Workbench")).toBeVisible();
  await learnConfirmation
    .getByRole("button", { name: "Learn Technology" })
    .click();
  await expect(page.getByText("Technology learned")).toBeVisible();
  await expect(learnConfirmation).toBeHidden();
  await page
    .getByRole("tabpanel", { name: "Technology" })
    .getByRole("button", { name: "Forget Technology" })
    .click();
  await page.getByRole("combobox", { name: "Unlocked technologies" }).click();
  await page.getByRole("option", { name: /Primitive Workbench/ }).click();
  await page
    .getByRole("combobox", { name: "Unlocked technologies" })
    .press("Escape");
  await page.getByRole("button", { name: "Continue" }).click();
  await page
    .getByRole("dialog", { name: "Confirm Forget Technology" })
    .getByRole("button", { name: "Forget Technology" })
    .click();
  await expect(page.getByText("Technology forgotten")).toBeVisible();
  await expect(page.getByText("Workbench")).toHaveCount(0);
  await expect(
    page.getByRole("dialog", { name: "Confirm Forget Technology" }),
  ).toBeHidden();
  await page.screenshot({
    path: "../../docs/screenshots/player-technology-management.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Progression" }).click();
  const progressionPanel = page.getByRole("tabpanel", { name: "Progression" });
  await expect(progressionPanel.getByText("Character")).toBeVisible();
  await expect(progressionPanel.getByText("1371")).toBeVisible();
  await expect(progressionPanel.getByText("Anubis").first()).toBeVisible();
  await page.screenshot({
    path: "../../docs/screenshots/player-progression.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Grant Progression" }).click();
  await page.getByLabel("Amount").fill("10");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Grant 10 Experience to Denalb?")).toBeVisible();
  await page.getByRole("button", { name: "Grant", exact: true }).click();
  await expect(page.getByText("Progression granted")).toBeVisible();
  await expect(page.getByText("1381")).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Confirm Progression Grant" }),
  ).toBeHidden();
  await expect(
    page.getByRole("dialog", { name: "Grant Progression" }),
  ).toBeHidden();
  await page.screenshot({
    path: "../../docs/screenshots/give-progression-success.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Actions" }).click();
  for (const action of ["Kick Player", "Ban Player"]) {
    await expect(page.getByRole("button", { name: action })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Give Item" })).toHaveCount(0);

  await setPalDefenderMode(page, "disabled");
  await page.goto("/servers/srv-test/players/0094A2FA000000000000000000000000");
  await expect(
    page
      .getByRole("alert", { name: "Enhanced player management unavailable" })
      .getByText("Enable PalDefender for this server"),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Denalb" })).toBeVisible();

  await setPalDefenderMode(page, "unreachable");
  await page.reload();
  await expect(
    page
      .getByRole("alert", { name: "Enhanced player management unavailable" })
      .getByText("PalDefender is temporarily unreachable"),
  ).toBeVisible();

  await setPalDefenderMode(page, "authentication_failed");
  await page.reload();
  await expect(
    page
      .getByRole("alert", { name: "Enhanced player management unavailable" })
      .getByText("PalDefender authentication failed"),
  ).toBeVisible();
});

async function openWorkspace(page: Page): Promise<void> {
  await page.goto("/servers/srv-test");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Palpagos Test Server",
    }),
  ).toBeVisible();
}

function panelWithHeading(page: Page, name: string) {
  return page
    .locator(".pc-panel")
    .filter({ has: page.getByRole("heading", { name }) });
}

test("server overview uses branded status, configuration, and networking surfaces", async ({
  page,
}) => {
  await openWorkspace(page);

  for (const heading of ["Server Status", "Configuration", "Networking"]) {
    const panel = panelWithHeading(page, heading);
    await expect(panel).toHaveCount(1);
    await expect(panel).toBeVisible();
  }

  await expect(
    page.locator(".pc-page-header").getByText("Palpagos Dedicated Server"),
  ).toBeVisible();
  await expect(page.getByText("North America")).toBeVisible();
  await expect(page.getByText("203.0.113.10")).toBeVisible();
});

test("Administration selects a safe Broadcast provider without provider-oriented navigation", async ({
  page,
}) => {
  await resetBroadcasts(page);
  await setPalDefenderMode(page, "connected");
  await openWorkspace(page);
  await expect(page.getByRole("link", { name: "PalDefender" })).toHaveCount(0);
  await page.getByRole("tab", { name: "Administration" }).click();

  await expect(page.getByRole("heading", { name: "Broadcast" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Save World" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Server Shutdown" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Moderation" })).toBeVisible();
  await expect(page.getByText("steam_76561198000000001")).toBeVisible();
  await expect(page.getByText("192.0.2.10")).toBeVisible();
  await page.screenshot({
    path: "../../docs/screenshots/moderation-management.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Unban IP" }).click();
  await page
    .getByRole("dialog", { name: "Unban IP" })
    .getByRole("button", { name: "Unban IP" })
    .click();
  await expect(page.getByText("No active IP bans found.")).toBeVisible();
  await page.getByLabel("IP address").fill("192.0.2.10");
  await page.getByRole("button", { name: "Ban IP Address" }).click();
  await page.getByRole("button", { name: "Ban IP", exact: true }).click();
  await expect(page.getByText("The IP address is now banned.")).toBeVisible();
  await expect(page.getByText("192.0.2.10")).toBeVisible();
  await page.getByLabel("Announcement").fill("Connected provider broadcast");
  await page.getByRole("button", { name: "Send Broadcast" }).click();
  await expect(page.getByText("Announcement sent.").last()).toBeVisible();
  await expect(page.getByLabel("Announcement")).toHaveValue("");

  await setPalDefenderMode(page, "disabled");
  await page.getByLabel("Announcement").fill("Native broadcast");
  await page.getByRole("button", { name: "Send Broadcast" }).click();
  await expect(page.getByText("Announcement sent.").last()).toBeVisible();
  await expect(page.getByLabel("Announcement")).toHaveValue("");

  await setPalDefenderMode(page, "unreachable");
  await page.getByLabel("Announcement").fill("Safe native fallback");
  await page.getByRole("button", { name: "Send Broadcast" }).click();
  await expect(page.getByText("Announcement sent.").last()).toBeVisible();
  await expect(page.getByLabel("Announcement")).toHaveValue("");

  await expect
    .poll(async () => (await recordedBroadcasts(page)).broadcasts)
    .toEqual([
      { serverId: "srv-test", provider: "paldefender" },
      { serverId: "srv-test", provider: "native" },
      { serverId: "srv-test", provider: "native" },
    ]);
});

test("players empty and populated states remain branded and scroll safely", async ({
  page,
}) => {
  await setPlayerMode(page, "empty");
  await openWorkspace(page);
  await page.getByRole("tab", { name: "Players" }).click();

  const emptyPanel = panelWithHeading(page, "No players online");
  await expect(emptyPanel).toHaveCount(1);
  await expect(emptyPanel).toBeVisible();

  await setPlayerMode(page, "populated");
  await page.reload();
  await page.getByRole("tab", { name: "Players" }).click();
  await expect(page.getByRole("cell", { name: "Denalb" })).toBeVisible();

  await page.setViewportSize({ width: 480, height: 900 });
  const tablePanel = page
    .locator(".pc-panel")
    .filter({ has: page.getByRole("table") });
  await expect(tablePanel).toHaveCount(1);
  const scrollState = await tablePanel.evaluate((panel) => {
    const table = panel.querySelector("table");
    let viewport = table?.parentElement ?? null;
    while (
      viewport &&
      !["auto", "scroll"].includes(getComputedStyle(viewport).overflowX)
    ) {
      viewport = viewport.parentElement;
    }
    return {
      pageOverflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
      contained: viewport
        ? viewport.scrollWidth > viewport.clientWidth
        : panel.scrollWidth > panel.clientWidth,
    };
  });
  expect(scrollState.pageOverflow).toBe(false);
  expect(scrollState.contained).toBe(true);
});

test("profile and backup routes retain branded form and warning structure", async ({
  page,
}) => {
  await page.goto("/profile");
  await expect(page.getByText("ui-review@localhost.invalid")).toBeVisible();
  await expect(page.locator(".pc-panel")).toHaveCount(2);

  const passwordForm = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "Change Password" }) });
  await expect(passwordForm).toHaveCount(1);
  await expect(passwordForm.locator(".pc-panel")).toHaveCount(1);
  await expect(
    passwordForm.getByRole("textbox", { name: "Current password" }),
  ).toBeVisible();

  await page.goto("/backup");
  await expect(panelWithHeading(page, "Current data")).toHaveCount(1);
  await expect(panelWithHeading(page, "Restore a backup")).toHaveCount(1);
  const warning = page.getByRole("alert").filter({
    hasText: "A restore replaces all server connections",
  });
  await expect(warning).toBeVisible();
  await expect(warning).toContainText("Create a current backup first.");
});

test("workspace tabs and responsive headers remain usable at narrow width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await openWorkspace(page);

  const overviewTab = page.getByRole("tab", { name: "Overview" });
  await expect(overviewTab).toHaveAttribute("data-active", "true");

  const tabList = page.getByRole("tablist");
  const tabLayout = await tabList.evaluate((element) => ({
    scrollable: element.scrollWidth > element.clientWidth,
    pageOverflow:
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  }));
  expect(tabLayout.scrollable).toBe(true);
  expect(tabLayout.pageOverflow).toBe(false);

  await page.getByRole("tab", { name: "Players" }).click();
  const playersHeading = page.getByRole("heading", { name: "Players" });
  const refresh = page.getByRole("button", { name: "Refresh" });
  const alignment = await page.evaluate(() => {
    const heading = [...document.querySelectorAll("h2")].find(
      (element) => element.textContent === "Players",
    );
    const button = [...document.querySelectorAll("button")].find(
      (element) => element.textContent?.trim() === "Refresh",
    );
    if (!heading || !button) throw new Error("Responsive header is missing.");
    return {
      headingBottom: heading.getBoundingClientRect().bottom,
      actionTop: button.getBoundingClientRect().top,
      pageOverflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    };
  });
  await expect(playersHeading).toBeVisible();
  await expect(refresh).toBeVisible();
  expect(alignment.actionTop).toBeGreaterThanOrEqual(alignment.headingBottom);
  expect(alignment.pageOverflow).toBe(false);
});

test("danger zone communicates destructive intent beyond its color", async ({
  page,
}) => {
  await openWorkspace(page);
  const danger = page.locator(".pc-panel.pc-danger-card");
  await expect(danger).toHaveCount(1);
  await expect(danger).toContainText("Remove server");
  await expect(danger).toContainText(
    "Remove this saved connection and its metrics, events, and tracked player state",
  );
  await expect(
    danger.getByRole("button", { name: "Remove server" }),
  ).toBeVisible();
});

test("world map empty and failure states explain the next action", async ({
  page,
}) => {
  await setPlayerMode(page, "empty");
  await openWorkspace(page);
  await page.getByRole("tab", { name: "Map" }).click();
  await expect(
    page.getByRole("heading", { name: "No players online" }),
  ).toBeVisible();
  await expect(
    page.getByText(/markers and movement trails will appear/),
  ).toBeVisible();

  await setPlayerMode(page, "error");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Live map data is unavailable" }),
  ).toContainText("REST credentials");
  await expect(
    page.getByRole("heading", { name: "Player data could not be loaded" }),
  ).toBeVisible();
  await expect(page.getByText("fetch failed")).toHaveCount(0);
  await expect(page.getByText("database unavailable")).toHaveCount(0);
});

test("world map controls remain reachable without page overflow at narrow width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 720, height: 900 });
  await setPlayerMode(page, "populated");
  await openWorkspace(page);
  await page.getByRole("tab", { name: "Map" }).click();

  await expect(
    page.getByRole("button", { name: "Refresh", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Fit Map", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Zoom in")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("REST map fallback keeps unverified locations visible and authoritative locations off-map", async ({
  page,
}) => {
  await setSessionRole(page, "administrator");
  await setPlayerMode(page, "unknown");
  await openWorkspace(page);
  await page.getByRole("tab", { name: "Map" }).click();
  await expect(page.getByLabel("View Denalb on map")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Online now" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "View Denalb on the living world map" }),
  ).toBeVisible();
  await expect(page.getByText("Off-map players")).toHaveCount(0);
  await page.getByLabel("View Denalb on map").click();
  await expect(
    page.getByRole("button", { name: "Center Player" }),
  ).toBeEnabled();
  const follow = page.getByRole("button", { name: "Follow Player" });
  await follow.click();
  await expect(follow).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("switch", { name: "Show movement trail" }).check();
  await expect(
    page.locator(".pc-world-map-trail-segment").first(),
  ).toBeVisible();
  await expect(page.getByText("Trail data details")).toBeVisible();
  await page.screenshot({
    path: "../../docs/screenshots/living-world-map.png",
    fullPage: true,
  });

  const mapImage = page.locator("img.pc-world-map-image").first();
  await expect(mapImage).toHaveAttribute("src", /world-map-2048\.webp/);

  await page.getByLabel("Choose world map").getByText("World Tree").click();
  await expect(page.getByText("World Tree map coming later")).toHaveCount(0);
  await expect(mapImage).toHaveAttribute("src", /world-tree-2048\.webp/);
  // Switching maps resets the viewport to fit; zoom/pan work in tree view.
  await expect(page.getByLabel("Zoom out")).toBeDisabled();
  await page.getByLabel("Zoom in").click();
  await expect(page.getByLabel("Zoom out")).toBeEnabled();
  await page.screenshot({
    path: "../../docs/screenshots/living-world-map-world-tree.png",
    fullPage: true,
  });
  await page.getByLabel("Choose world map").getByText("Palpagos").click();
  await expect(mapImage).toHaveAttribute("src", /world-map-2048\.webp/);
  await expect(page.getByLabel("Zoom out")).toBeDisabled();

  await setPlayerMode(page, "instance");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByLabel("View Denalb on map")).toBeVisible();
  await expect(page.getByText("Off-map players")).toHaveCount(0);

  await setPlayerMode(page, "world-tree");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  // The authoritative world_tree sample is off-map in the Palpagos view even
  // though its coordinates are inside the tree bounds.
  await expect(page.getByLabel("View Denalb on map")).toHaveCount(0);
  await expect(
    page.getByText("In World Tree — switch to World Tree map"),
  ).toBeVisible();
  // Explicitly following the off-map player is an intentional transition to
  // its authoritative map.
  await page.getByRole("button", { name: "View details" }).first().click();
  const treeFollow = page.getByRole("button", { name: "Follow Player" });
  await expect(treeFollow).toBeEnabled();
  await treeFollow.click();
  await expect(treeFollow).toHaveAttribute("aria-pressed", "true");
  await expect(mapImage).toHaveAttribute("src", /world-tree-2048\.webp/);
  await expect(page.getByLabel("View Denalb on map")).toBeVisible();
  await page.screenshot({
    path: "../../docs/screenshots/rest-map-authoritative-off-map.png",
    fullPage: true,
  });
  await page.getByLabel("Choose world map").getByText("Palpagos").click();
  await expect(mapImage).toHaveAttribute("src", /world-map-2048\.webp/);

  await setPlayerMode(page, "stale");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByLabel("View Denalb on map")).toBeVisible();
  await expect(page.getByText("Stale").first()).toBeVisible();
  await expect(page.getByText("Off-map players")).toHaveCount(0);
  await setPlayerMode(page, "unknown");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.setViewportSize({ width: 720, height: 900 });
  const closeNavigation = page.getByRole("button", {
    name: "Close navigation",
  });
  if (await closeNavigation.isVisible()) await closeNavigation.click();
  await page.screenshot({
    path: "../../docs/screenshots/rest-map-fallback-narrow.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Fit Map", exact: true }).focus();
  await expect(
    page.getByRole("button", { name: "Fit Map", exact: true }),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
});

test("long StatCard values wrap fully without colliding with their icon", async ({
  page,
}) => {
  await page.setViewportSize({ width: 420, height: 900 });
  await page.goto("/automation");

  const card = page
    .locator(".pc-stat-card")
    .filter({ hasText: "Next Scheduled Run" });
  await expect(card).toHaveCount(1);
  const value = card.locator(".pc-stat-card-value");
  await expect(value).toContainText("2026");

  const layout = await card.evaluate((element) => {
    const valueElement = element.querySelector<HTMLElement>(
      ".pc-stat-card-value",
    );
    const iconElement =
      element.querySelector<HTMLElement>(".pc-stat-card-icon");
    if (!valueElement || !iconElement) {
      throw new Error("Stat card fixture is incomplete.");
    }
    const valueRect = valueElement.getBoundingClientRect();
    const iconRect = iconElement.getBoundingClientRect();
    const style = getComputedStyle(valueElement);
    return {
      lineClamp: style.webkitLineClamp,
      overflow: style.overflow,
      fullyVisible: valueElement.scrollHeight <= valueElement.clientHeight,
      separateFromIcon: valueRect.right <= iconRect.left,
      pageOverflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    };
  });

  expect(layout.lineClamp).toBe("none");
  expect(layout.overflow).toBe("visible");
  expect(layout.fullyVisible).toBe(true);
  expect(layout.separateFromIcon).toBe(true);
  expect(layout.pageOverflow).toBe(false);
});
