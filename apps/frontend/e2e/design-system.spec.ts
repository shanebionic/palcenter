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

async function setEventMode(
  page: Page,
  mode: "empty" | "error" | "populated",
): Promise<void> {
  const response = await page.request.get(
    `http://127.0.0.1:3198/__test/events?mode=${mode}`,
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

async function setCompanionMode(
  page: Page,
  mode:
    | "connected"
    | "exact-location"
    | "disconnected"
    | "authentication_required"
    | "authentication_failed",
) {
  const response = await page.request.get(
    `http://127.0.0.1:3198/__test/companion?mode=${mode}`,
  );
  expect(response.ok()).toBe(true);
}

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

test("Companion discovery presents connected, disconnected, refresh, and responsive states", async ({
  page,
}) => {
  await setCompanionMode(page, "connected");
  await openWorkspace(page);
  await page.getByRole("tab", { name: "Connection Settings" }).click();
  const companion = panelWithHeading(page, "PalCenter Companion");
  await expect(companion).toContainText("Healthy");
  await expect(companion).toContainText("Version: 0.3.0");
  await expect(companion).toContainText("Supported capabilities: 3");
  await companion.getByRole("button", { name: "Advanced details" }).click();
  await expect(companion).toContainText(
    "Capabilities: health, version, playerActivity",
  );
  const settings = page.getByRole("button", {
    name: "Advanced Companion Connection",
  });
  await settings.click();
  await expect(page.getByLabel("Companion host")).toHaveValue(
    "companion.internal",
  );
  await expect(page.getByLabel("Companion port")).toHaveValue("18213");
  await expect(page.getByLabel("Companion API token")).toHaveValue("");
  await expect(page.getByText(/A token is configured/)).toBeVisible();
  await page.screenshot({
    path: "../../docs/screenshots/companion-connected.png",
    fullPage: true,
  });

  await setCompanionMode(page, "disconnected");
  await companion.getByRole("button", { name: "Refresh" }).click();
  await expect(companion).toContainText("Unreachable");

  await setCompanionMode(page, "authentication_required");
  await companion.getByRole("button", { name: "Refresh" }).click();
  await expect(companion).toContainText("Authentication required");
  await setCompanionMode(page, "authentication_failed");
  await companion.getByRole("button", { name: "Refresh" }).click();
  await expect(companion).toContainText("Authentication failed");
  await page.screenshot({
    path: "../../docs/screenshots/companion-disconnected.png",
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    companion.getByRole("button", { name: "Refresh" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
  await page.screenshot({
    path: "../../docs/screenshots/companion-responsive.png",
    fullPage: true,
  });
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

test("map keeps administrator calibration tools behind an advanced disclosure", async ({
  page,
}) => {
  await setPlayerMode(page, "populated");
  await openWorkspace(page);
  await page.getByRole("tab", { name: "Map" }).click();

  const viewport = page.locator(".pc-world-map-viewport");
  await expect(viewport).toBeVisible();
  await expect(viewport).toHaveCSS("position", "relative");
  await expect(viewport).toHaveCSS("overflow", "hidden");
  expect(
    await viewport.evaluate((element) => element.clientHeight),
  ).toBeGreaterThanOrEqual(500);

  await expect(page.getByRole("combobox", { name: "Map layer" })).toBeHidden();
  await page.getByRole("button", { name: "Advanced map tools" }).click();
  await expect(page.getByRole("combobox", { name: "Map layer" })).toBeVisible();
  await page
    .getByRole("switch", { name: /Enable calibration diagnostics/ })
    .check();
  const calibration = panelWithHeading(page, "Projection calibration");
  await expect(calibration).toHaveCount(1);
  await expect(calibration).toBeVisible();
});

test("activity summary prioritizes key status and discloses secondary details", async ({
  page,
}) => {
  await setPlayerMode(page, "populated");
  await openWorkspace(page);
  await page.getByRole("tab", { name: "Map" }).click();
  await page.getByRole("button", { name: "View Denalb on map" }).click();
  await page.getByRole("switch", { name: "Show movement trail" }).check();

  const summary = page.getByRole("region", {
    name: "Player activity summary",
  });
  await expect(summary).toBeVisible();
  await expect(summary).toContainText("Selected range");
  await expect(summary).toContainText("Observed span");
  await expect(summary).toContainText("Travel distance");
  await expect(summary).toContainText("Player status");
  await expect(summary.getByText("Average movement speed")).toBeHidden();

  await summary
    .getByRole("button", { name: "Detailed movement statistics" })
    .click();
  await expect(summary.getByText("Average movement speed")).toBeVisible();
  await summary.getByRole("button", { name: "Timeline and insights" }).click();
  await expect(
    summary.getByRole("heading", { name: "Timeline" }),
  ).toBeVisible();
  await expect(
    summary.getByRole("heading", { name: "Insights" }),
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
  await setCompanionMode(page, "connected");
  await setPlayerMode(page, "unknown");
  await openWorkspace(page);
  await page.getByRole("tab", { name: "Map" }).click();
  await expect(
    page.getByRole("alert").filter({
      hasText: "Special areas may not appear correctly",
    }),
  ).toBeVisible();
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
  await expect(
    page.getByRole("region", { name: "Player activity summary" }),
  ).toContainText("Travel distance");
  await page.screenshot({
    path: "../../docs/screenshots/living-world-map.png",
    fullPage: true,
  });

  await page.getByLabel("Choose world map").getByText("World Tree").click();
  await expect(page.getByText("World Tree map coming later")).toBeVisible();
  await page.screenshot({
    path: "../../docs/screenshots/living-world-map-world-tree.png",
    fullPage: true,
  });
  await page.getByLabel("Choose world map").getByText("Palpagos").click();

  await setPlayerMode(page, "instance");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByLabel("View Denalb on map")).toBeVisible();
  await expect(page.getByText("Off-map players")).toHaveCount(0);

  await setCompanionMode(page, "exact-location");
  await setPlayerMode(page, "world-tree");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByText("Exact location from Companion")).toBeVisible();
  await expect(page.getByText(/In World Tree/).first()).toBeVisible();
  await expect(page.getByLabel("View Denalb on map")).toHaveCount(0);
  await page.screenshot({
    path: "../../docs/screenshots/rest-map-authoritative-off-map.png",
    fullPage: true,
  });

  await setCompanionMode(page, "connected");
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

test("Player Activity renders, filters, expands evidence, loads history, and links to the map", async ({
  page,
}) => {
  await setSessionRole(page, "administrator");
  await setEventMode(page, "populated");
  await setCompanionMode(page, "connected");
  await openWorkspace(page);
  await page.getByRole("tab", { name: "Activity" }).click();

  await expect(
    page.getByRole("heading", { name: "Recent Activity" }),
  ).toBeVisible();
  await expect(page.locator(".pc-world-event-entry")).toHaveCount(50);
  await expect(page.getByText("High confidence").first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Rapid relocation detected" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Entered an instanced area" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Changed map area" }),
  ).toBeVisible();
  const instanceEvent = page
    .locator(".pc-world-event-entry")
    .filter({ hasText: "Entered an instanced area" });
  await expect(
    instanceEvent.getByText(
      "Destination map unavailable (instance:fixture-dungeon coordinate space).",
    ),
  ).toBeVisible();
  await instanceEvent.getByText("Evidence and details").click();
  await expect(
    instanceEvent.getByText("Matched transition: Fixture Dungeon"),
  ).toBeVisible();
  await expect(instanceEvent.getByText(/^Distance:/)).toHaveCount(0);
  await expect(instanceEvent.getByText(/^Implied speed:/)).toHaveCount(0);

  const firstEvent = page.locator(".pc-world-event-entry").first();
  await firstEvent.getByText("Evidence and details").click();
  await expect(
    firstEvent.getByText("Player moved 375000 world units in 30 seconds."),
  ).toBeVisible();
  await expect(
    firstEvent.getByText(
      "Implied travel speed was 12500 world units per second.",
    ),
  ).toBeVisible();
  await expect(
    firstEvent.getByText(/Origin: X -120000, Y 85000/),
  ).toBeVisible();
  await expect(firstEvent.getByText(/Confidence: 90%/)).toBeVisible();

  await page.getByRole("button", { name: "Load older activity" }).click();
  await expect(page.locator(".pc-world-event-entry")).toHaveCount(55);

  await page.getByRole("combobox", { name: "Activity type" }).click();
  await page.getByRole("option", { name: "Rapid relocation detected" }).click();
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.locator(".pc-world-event-entry")).toHaveCount(3);
  await expect(
    page.getByRole("heading", { name: "Rapid relocation detected" }).first(),
  ).toBeVisible();

  await page.getByRole("button", { name: "Reset filters" }).click();
  await page
    .getByRole("button", { name: "View origin on map" })
    .first()
    .click();
  await expect(page.getByRole("tab", { name: "Map" })).toHaveAttribute(
    "data-active",
    "true",
  );
  await expect(page.getByText("Event location centered")).toBeVisible();
  await page.getByRole("tab", { name: "Activity" }).click();
  await page
    .getByRole("button", { name: "View destination on map" })
    .first()
    .click();
  await expect(page.getByText("Event location centered")).toBeVisible();
});

test("Player Activity provides useful empty and unavailable states", async ({
  page,
}) => {
  await setSessionRole(page, "administrator");
  await setEventMode(page, "empty");
  await setCompanionMode(page, "disconnected");
  await openWorkspace(page);
  await page.getByRole("tab", { name: "Activity" }).click();
  await expect(page.getByText("No activity yet")).toBeVisible();
  await expect(
    page.getByText(/Player activity will appear here/),
  ).toBeVisible();
  await expect(
    page.getByText("Using standard server information"),
  ).toBeVisible();

  await setEventMode(page, "error");
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(
    page.getByText("Player activity is temporarily unavailable"),
  ).toBeVisible();
});

test("Player Activity remains responsive and is not offered to Visitors", async ({
  page,
}) => {
  await setSessionRole(page, "administrator");
  await setEventMode(page, "populated");
  await setCompanionMode(page, "connected");
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorkspace(page);
  await page.getByRole("tab", { name: "Activity" }).click();
  await expect(page.getByLabel("Player ID")).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Activity type" }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Time range" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Rapid relocation detected" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);

  await setSessionRole(page, "visitor");
  await page.reload();
  await expect(page.getByRole("tab", { name: "Activity" })).toHaveCount(0);
});
