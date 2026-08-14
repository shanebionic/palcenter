import { expect, test, type Page } from "@playwright/test";

async function setSessionRole(
  page: Page,
  role: "administrator" | "moderator" | "visitor",
): Promise<void> {
  const response = await page.request.get(
    `http://127.0.0.1:3198/__test/role?role=${role}`,
  );
  expect(response.ok()).toBe(true);
}

async function setServerStatusMode(
  page: Page,
  mode: "populated" | "empty",
  reset = false,
): Promise<void> {
  const response = await page.request.get(
    `http://127.0.0.1:3198/__test/servers?mode=${mode}${reset ? "&reset=true" : ""}`,
  );
  expect(response.ok()).toBe(true);
}

test("Add Server action lives on Servers, not the Dashboard", async ({
  page,
}) => {
  await setSessionRole(page, "administrator");
  await setServerStatusMode(page, "populated", true);

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Server Command Center" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add Server", exact: true }),
  ).toHaveCount(0);

  await page.goto("/servers");
  await expect(page.getByRole("heading", { name: "Servers" })).toBeVisible();
  const addServerButton = page.getByRole("button", {
    name: "Add Server",
    exact: true,
  });
  await expect(addServerButton).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Palpagos Test Server" }),
  ).toBeVisible();

  await addServerButton.click();
  const dialog = page.getByRole("dialog", { name: "Add Palworld server" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Test Connection" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

  await setSessionRole(page, "visitor");
  await page.goto("/servers");
  await expect(
    page.getByRole("button", { name: "Add Server", exact: true }),
  ).toHaveCount(0);

  await setServerStatusMode(page, "empty", true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Add Your First Server" }),
  ).toHaveCount(0);

  await page.goto("/");
  await expect(page.getByRole("button", { name: /Add .* Server/ })).toHaveCount(
    0,
  );
});

test("Add Server saves from the Servers page and refreshes the list", async ({
  page,
}) => {
  await setSessionRole(page, "administrator");
  await setServerStatusMode(page, "empty", true);
  await page.goto("/servers");

  const emptyStateAction = page.getByRole("button", {
    name: "Add Your First Server",
  });
  await expect(emptyStateAction).toBeVisible();
  await emptyStateAction.click();

  const dialog = page.getByRole("dialog", { name: "Add Palworld server" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Display Name").fill("Added Test Server");
  await dialog.getByLabel("REST URL").fill("http://added.example:8212");
  await dialog.getByLabel("Admin Password").fill("mock-admin-password");

  await dialog.getByRole("button", { name: "Test Connection" }).click();
  await expect(dialog.getByText("Connection successful")).toBeVisible();

  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Added Test Server" }),
  ).toBeVisible();
});
