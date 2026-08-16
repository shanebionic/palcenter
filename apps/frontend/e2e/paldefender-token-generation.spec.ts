import { expect, test, type Page } from "@playwright/test";

async function openCredentialPanel(page: Page): Promise<void> {
  const role = await page.request.get(
    "http://127.0.0.1:3198/__test/role?role=administrator",
  );
  expect(role.ok()).toBe(true);
  await page.goto("/users");
  await expect(
    page.getByRole("heading", { name: "PalDefender user credentials" }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Server" }).click();
  await page.getByRole("option", { name: "Palpagos Test Server" }).click();
  await expect(
    page.getByRole("button", { name: "Generate Token" }).first(),
  ).toBeVisible();
}

test("Generate token shows a one-time file and is not saved by default", async ({
  page,
}) => {
  await openCredentialPanel(page);
  await page.getByRole("button", { name: "Generate Token" }).first().click();

  const dialog = page.getByRole("dialog", {
    name: "Generate PalDefender token",
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("checkbox", {
      name: /also assign this token to ui-review/i,
    }),
  ).not.toBeChecked();

  await dialog.getByRole("button", { name: "Generate Token" }).click();

  const created = page.getByRole("dialog", { name: "Token file created" });
  await expect(created).toBeVisible();
  await expect(created.getByText(/shown only once/i)).toBeVisible();
  await expect(created.getByText("PalCenter-usr-ui-test.json")).toBeVisible();
  const fileContent = created.getByLabel("Token file content");
  await expect(fileContent).toBeVisible();
  const content = await fileContent.inputValue();
  expect(content).toContain('"Name": "PalCenter-ui-review-UITEST01"');
  expect(content).toMatch(/"Token": "[0-9a-f]{64}"/);
  expect(content).toContain('"Permissions"');

  await created.getByRole("button", { name: "I Saved the File" }).click();
  await expect(created).toBeHidden();

  // Without assign the row keeps the server token.
  await expect(page.getByText("Server token")).toBeVisible();
  await expect(page.getByText("Personal token")).toHaveCount(0);
});

test("Generate token with assign stores the token for the account", async ({
  page,
}) => {
  await openCredentialPanel(page);
  await page.getByRole("button", { name: "Generate Token" }).first().click();

  const dialog = page.getByRole("dialog", {
    name: "Generate PalDefender token",
  });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("checkbox", { name: /also assign this token to ui-review/i })
    .check();

  await dialog.getByRole("button", { name: "Generate Token" }).click();

  const created = page.getByRole("dialog", { name: "Token file created" });
  await expect(created).toBeVisible();
  await expect(
    created.getByText(/this token is also assigned to ui-review/i),
  ).toBeVisible();

  await created.getByRole("button", { name: "I Saved the File" }).click();
  await expect(created).toBeHidden();

  // The row now shows the stored personal token and offers removal.
  await expect(page.getByText("Personal token")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove" })).toBeVisible();
});
