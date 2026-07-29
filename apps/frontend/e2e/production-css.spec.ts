import { expect, test, type Page } from "@playwright/test";

async function productionStylesheetUrls(page: Page): Promise<string[]> {
  await page.goto("/setup");
  return page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) =>
      links
        .map((link) => (link as HTMLLinkElement).href)
        .filter((href) => href.length > 0),
    );
}

test("production browser receives usable world map viewport styles", async ({
  page,
}) => {
  const stylesheetUrls = await productionStylesheetUrls(page);
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
    ${stylesheetUrls.map((url) => `<link rel="stylesheet" href="${url}">`).join("")}
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

test("marker and label retain Fit Map screen size while the map zooms", async ({
  page,
}) => {
  const stylesheetUrls = await productionStylesheetUrls(page);
  await page.setContent(`
    ${stylesheetUrls.map((url) => `<link rel="stylesheet" href="${url}">`).join("")}
    <main style="width: 1200px">
      <div class="pc-world-map-viewport">
        <div class="pc-world-map-surface" style="width: 700px; height: 700px; transition: none;">
          <div class="pc-world-map-marker-position" style="left: 69.19%; top: 45.55%;">
            <div class="pc-world-map-marker-visual">
              <button
                type="button"
                data-player-id="uid-denalb"
                class="pc-world-map-marker pc-world-map-marker-live"
                aria-label="View Denalb on map"
              >
                <span aria-hidden="true">D</span>
              </button>
              <span class="pc-world-map-marker-label" aria-hidden="true">Denalb</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  `);

  const marker = page.locator('[data-player-id="uid-denalb"]');

  await marker.evaluate((button) => {
    button.addEventListener("click", () => {
      button.setAttribute("data-selected", "true");
    });
  });

  async function measureAtZoom(zoom: number) {
    await page.locator(".pc-world-map-surface").evaluate((surface, value) => {
      const visual = surface.querySelector<HTMLElement>(
        ".pc-world-map-marker-visual",
      );
      if (!visual) throw new Error("Marker visual fixture is missing.");
      surface.style.transform = `translate(-50%, -50%) scale(${value})`;
      visual.style.transform = `scale(${1 / value})`;
    }, zoom);

    return page.evaluate(() => {
      const button = document.querySelector<HTMLElement>(
        '[data-player-id="uid-denalb"]',
      );
      const text = document.querySelector<HTMLElement>(
        ".pc-world-map-marker-label",
      );
      if (!button || !text) throw new Error("Marker fixture is missing.");
      const buttonRect = button.getBoundingClientRect();
      const labelRect = text.getBoundingClientRect();
      return {
        marker: {
          width: buttonRect.width,
          height: buttonRect.height,
          centerX: buttonRect.left + buttonRect.width / 2,
          centerY: buttonRect.top + buttonRect.height / 2,
        },
        label: {
          height: labelRect.height,
          fontSize: getComputedStyle(text).fontSize,
          gap: labelRect.left - buttonRect.right,
        },
      };
    });
  }

  const fit = await measureAtZoom(1);
  const zoom2 = await measureAtZoom(2);
  const zoom4 = await measureAtZoom(4);

  for (const measurement of [zoom2, zoom4]) {
    expect(
      Math.abs(measurement.marker.width - fit.marker.width),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(measurement.marker.height - fit.marker.height),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(measurement.label.height - fit.label.height),
    ).toBeLessThanOrEqual(1);
    expect(Math.abs(measurement.label.gap - fit.label.gap)).toBeLessThanOrEqual(
      1,
    );
    expect(measurement.label.fontSize).toBe(fit.label.fontSize);
  }
  expect(Math.abs(zoom2.marker.centerX - fit.marker.centerX)).toBeGreaterThan(
    50,
  );
  expect(Math.abs(zoom4.marker.centerX - zoom2.marker.centerX)).toBeGreaterThan(
    50,
  );

  await marker.click();
  await expect(marker).toHaveAttribute("data-selected", "true");

  await page.locator(".pc-world-map-surface").evaluate((surface) => {
    const visual = surface.querySelector<HTMLElement>(
      ".pc-world-map-marker-visual",
    );
    const button = surface.querySelector<HTMLElement>(
      '[data-player-id="uid-denalb"]',
    );
    if (!visual || !button) throw new Error("Marker fixture is missing.");
    const zoom = 2;
    const size = 700;
    const panX = -(0.6919 - 0.5) * size * zoom;
    const panY = -(0.4555 - 0.5) * size * zoom;
    surface.style.transform = `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px)) scale(${zoom})`;
    visual.style.transform = `scale(${1 / zoom})`;
    button.classList.add("pc-world-map-marker-focused");
  });

  const centered = await marker.evaluate((button) => {
    const viewport = button.closest(".pc-world-map-viewport");
    if (!viewport) throw new Error("Viewport fixture is missing.");
    const markerRect = button.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    return {
      markerCenterX: markerRect.left + markerRect.width / 2,
      markerCenterY: markerRect.top + markerRect.height / 2,
      viewportCenterX: viewportRect.left + viewportRect.width / 2,
      viewportCenterY: viewportRect.top + viewportRect.height / 2,
      animationName: getComputedStyle(button).animationName,
    };
  });
  expect(
    Math.abs(centered.markerCenterX - centered.viewportCenterX),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(centered.markerCenterY - centered.viewportCenterY),
  ).toBeLessThanOrEqual(1);
  expect(centered.animationName).toContain("pc-world-map-marker-pulse");
});
