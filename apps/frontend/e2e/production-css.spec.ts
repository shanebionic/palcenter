import { expect, test } from "@playwright/test";

test("production browser receives usable world map viewport styles", async ({
  page,
}) => {
  await page.goto("/setup");

  const stylesheetUrls = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) =>
      links
        .map((link) => (link as HTMLLinkElement).href)
        .filter((href) => href.length > 0),
    );
  expect(stylesheetUrls.length).toBeGreaterThan(0);

  const deliveredCss = (
    await Promise.all(
      stylesheetUrls.map(async (url) => {
        const response = await page.request.get(url);
        expect(response.ok()).toBe(true);
        return response.text();
      }),
    )
  ).join("\n");
  expect(deliveredCss).toContain(".pc-world-map-viewport");

  await page.setContent(`
    <link rel="stylesheet" href="${stylesheetUrls[0]}">
    <main style="width: 1200px">
      <div class="pc-world-map-viewport">
        <div class="pc-world-map-surface"></div>
      </div>
    </main>
  `);

  await page.waitForFunction(() =>
    [...document.styleSheets].some((sheet) => {
      try {
        return [...sheet.cssRules].some((rule) =>
          rule.cssText.includes(".pc-world-map-viewport"),
        );
      } catch {
        return false;
      }
    }),
  );

  const deliveredViewportRules = await page.evaluate(() =>
    [...document.styleSheets].flatMap((sheet) => {
      try {
        return [...sheet.cssRules]
          .filter((rule) => rule.cssText.includes(".pc-world-map-viewport"))
          .map((rule) => rule.cssText);
      } catch {
        return [];
      }
    }),
  );
  expect(deliveredViewportRules.length).toBeGreaterThan(0);

  const viewport = page.locator(".pc-world-map-viewport");
  await expect(viewport).toHaveCSS("position", "relative");
  await expect(viewport).toHaveCSS("overflow", "hidden");

  const dimensions = await viewport.evaluate((element) => {
    const surface = element.querySelector<HTMLElement>(".pc-world-map-surface");
    if (!surface) throw new Error("Map surface fixture is missing.");

    const size = Math.min(element.clientWidth, element.clientHeight);
    surface.style.width = `${size}px`;
    surface.style.height = `${size}px`;

    return {
      viewportHeight: element.clientHeight,
      surfaceWidth: surface.offsetWidth,
      surfaceHeight: surface.offsetHeight,
      computed: {
        position: getComputedStyle(element).position,
        overflow: getComputedStyle(element).overflow,
      },
    };
  });

  expect(dimensions.computed).toEqual({
    position: "relative",
    overflow: "hidden",
  });
  expect(dimensions.viewportHeight).toBeGreaterThanOrEqual(500);
  expect(dimensions.surfaceWidth).toBeGreaterThan(0);
  expect(dimensions.surfaceWidth).toBe(dimensions.surfaceHeight);

  console.info({
    deliveredViewportRuleCount: deliveredViewportRules.length,
    ...dimensions,
  });
});
