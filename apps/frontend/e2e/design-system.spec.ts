import { expect, test, type Page } from "@playwright/test";

async function setPlayerMode(
  page: Page,
  mode: "empty" | "populated",
): Promise<void> {
  const response = await page.request.get(
    `http://127.0.0.1:3198/__test/players?mode=${mode}`,
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

test("map and calibration surfaces retain production layout styling", async ({
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

  await page.getByRole("switch", { name: "Calibration" }).check();
  const calibration = panelWithHeading(page, "Projection calibration");
  await expect(calibration).toHaveCount(1);
  await expect(calibration).toBeVisible();
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
