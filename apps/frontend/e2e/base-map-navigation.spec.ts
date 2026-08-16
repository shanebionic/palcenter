import { expect, test, type Page } from "@playwright/test";

const MOCK_API = "http://127.0.0.1:3198";

async function setPalDefenderMode(page: Page, mode: string): Promise<void> {
  const res = await page.request.get(
    `${MOCK_API}/__test/paldefender?mode=${mode}`,
  );
  expect(res.ok()).toBe(true);
}

async function setBasesMode(page: Page, mode: string): Promise<void> {
  const res = await page.request.get(
    `${MOCK_API}/__test/paldefender/bases?mode=${mode}`,
  );
  expect(res.ok()).toBe(true);
}

test("base deep link selects and centers the base on Palpagos", async ({
  page,
}) => {
  await setPalDefenderMode(page, "connected");
  await setBasesMode(page, "populated");

  await page.goto("/servers/srv-test?tab=map&base=Base-Camp_2");

  const marker = page.getByRole("button", {
    name: "View Pal Tamers at base Base-Camp_2",
  });
  await expect(marker).toBeVisible();
  await expect(marker).toHaveAttribute("aria-pressed", "true");

  await expect(page.getByRole("heading", { name: "Pal Tamers" })).toBeVisible();
  await expect(page.getByText("Base-Camp_2", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "View Base Details" }),
  ).toBeVisible();
});

test("deep link for a base that is not in the base data shows Base not found", async ({
  page,
}) => {
  await setPalDefenderMode(page, "connected");
  await setBasesMode(page, "populated");

  await page.goto("/servers/srv-test?tab=map&base=Base-Camp_Missing");

  await expect(
    page.getByRole("heading", { name: "Base not found" }),
  ).toBeVisible();
  await expect(
    page.getByText("Base-Camp_Missing", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "View on Palpagos" }),
  ).toHaveCount(0);
});

test("a failed base layer shows Location unavailable, never Base not found", async ({
  page,
}) => {
  await setPalDefenderMode(page, "connected");
  await setBasesMode(page, "error");

  await page.goto("/servers/srv-test?tab=map&base=Base-Camp_1");

  await expect(
    page.getByRole("heading", { name: "Location unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Base not found" }),
  ).toHaveCount(0);
  await expect(page.getByText("Base layer unavailable")).toBeVisible();
});

test("a known base on the World Tree map offers View on Palpagos", async ({
  page,
}) => {
  await setPalDefenderMode(page, "connected");
  await setBasesMode(page, "populated");

  await page.goto("/servers/srv-test?tab=map&base=Base-Camp_1");

  await expect(
    page.getByRole("button", {
      name: "View Pal Tamers at base Base-Camp_1",
    }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByText("World Tree", { exact: true }).click();

  const linkedCard = page.locator(".pc-panel", {
    has: page.getByRole("heading", {
      name: "Location unavailable on this map",
    }),
  });
  await expect(linkedCard).toBeVisible();
  const viewButton = linkedCard.getByRole("button", {
    name: "View on Palpagos",
  });
  await expect(viewButton).toBeVisible();
  await viewButton.click();

  await expect(page.getByRole("heading", { name: "Pal Tamers" })).toBeVisible();
  await expect(page.getByText("Base-Camp_1", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "View Pal Tamers at base Base-Camp_1",
    }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("guild base camp links open base details, which opens the linked map", async ({
  page,
}) => {
  await setPalDefenderMode(page, "connected");
  await setBasesMode(page, "populated");

  await page.goto("/servers/srv-test/guilds/guild-tamers");

  await expect(page.getByRole("heading", { name: "Base Camps" })).toBeVisible();
  await page.getByRole("link", { name: "Base-Camp_1", exact: true }).click();

  await expect(page).toHaveURL(
    /\/servers\/srv-test\/bases\/Base-Camp_1\?from=guilds/,
  );
  await expect(
    page.getByRole("heading", { name: "Base Details" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "View on map" })).toBeVisible();

  await page.getByRole("button", { name: "View on map" }).click();

  await expect(page).toHaveURL(/tab=map&base=Base-Camp_1/);
  await expect(
    page.getByRole("button", {
      name: "View Pal Tamers at base Base-Camp_1",
    }),
  ).toHaveAttribute("aria-pressed", "true");
});
