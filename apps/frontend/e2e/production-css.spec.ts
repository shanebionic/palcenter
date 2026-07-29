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

test("age-aware player trail remains readable, stable, and interactive", async ({
  page,
}) => {
  const stylesheetUrls = await productionStylesheetUrls(page);
  await page.setContent(`
    ${stylesheetUrls.map((url) => `<link rel="stylesheet" href="${url}">`).join("")}
    <main style="width: 1200px">
      <div class="pc-world-map-viewport">
        <div class="pc-world-map-surface" style="width: 700px; height: 700px; transition: none;">
          <svg class="pc-world-map-trail" viewBox="0 0 100 100" aria-label="Movement trail for Denalb">
            <line data-age="oldest" data-age-ratio="0" data-captured-at="2026-07-28T12:00:00.000Z"
              class="pc-world-map-trail-segment" x1="10" y1="20" x2="30" y2="35"
              stroke="#22d3ee" opacity="0.35" stroke-width="1.2" vector-effect="non-scaling-stroke"></line>
            <line data-age="middle" data-age-ratio="0.5" data-captured-at="2026-07-28T12:07:30.000Z"
              class="pc-world-map-trail-segment" x1="30" y1="35" x2="48" y2="44"
              stroke="#22d3ee" opacity="0.65" stroke-width="1.35" vector-effect="non-scaling-stroke"></line>
            <line data-age="newest" data-age-ratio="1" data-captured-at="2026-07-28T12:15:00.000Z"
              class="pc-world-map-trail-segment" x1="48" y1="44" x2="65" y2="55"
              stroke="#22d3ee" opacity="0.95" stroke-width="1.5" vector-effect="non-scaling-stroke"></line>
          </svg>
          <div class="pc-world-map-marker-position" style="left: 65%; top: 55%;">
            <div class="pc-world-map-marker-visual">
              <button type="button" data-player-id="user-a"
                class="pc-world-map-marker pc-world-map-marker-live"
                style="background-color: #22d3ee" aria-label="View Denalb on map">D</button>
            </div>
          </div>
        </div>
      </div>
      <div class="pc-world-map-trail-legend" aria-label="Trail age: faint is older and bright is newer"
        style="--pc-player-color: #22d3ee">
        <p>Older</p><span aria-hidden="true"></span><p>Newer</p>
      </div>
      <p data-range-summary>15-minute trail · 12:00 PM–12:15 PM</p>
      <button type="button" data-action="select-other">Select other player</button>
      <button type="button" data-action="center">Center Player</button>
      <button type="button" data-action="clear">Clear trail</button>
    </main>
  `);

  await page.evaluate(() => {
    document
      .querySelector('[data-action="select-other"]')
      ?.addEventListener("click", () => {
        const marker = document.querySelector<HTMLElement>(
          ".pc-world-map-marker",
        );
        const legend = document.querySelector<HTMLElement>(
          ".pc-world-map-trail-legend",
        );
        if (!marker || !legend) return;
        marker.dataset.playerId = "user-b";
        marker.style.backgroundColor = "#a3e635";
        legend.style.setProperty("--pc-player-color", "#a3e635");
        document
          .querySelectorAll<SVGLineElement>(".pc-world-map-trail-segment")
          .forEach((line) => line.setAttribute("stroke", "#a3e635"));
      });
    document
      .querySelector('[data-action="center"]')
      ?.addEventListener("click", () => {
        document
          .querySelector(".pc-world-map-marker")
          ?.setAttribute("data-centered", "true");
      });
    document
      .querySelector('[data-action="clear"]')
      ?.addEventListener("click", () => {
        document.querySelector(".pc-world-map-trail")?.remove();
        document.querySelector(".pc-world-map-trail-legend")?.remove();
      });
  });

  const oldest = page.locator('[data-age="oldest"]');
  const newest = page.locator('[data-age="newest"]');
  const marker = page.locator(".pc-world-map-marker");
  const legend = page.locator(".pc-world-map-trail-legend");
  await expect(legend).toContainText("Older");
  await expect(legend).toContainText("Newer");
  await expect(page.locator("[data-range-summary]")).toContainText(
    "15-minute trail",
  );

  const styles = await page.evaluate(() => {
    const oldLine = document.querySelector<SVGLineElement>(
      '[data-age="oldest"]',
    );
    const newLine = document.querySelector<SVGLineElement>(
      '[data-age="newest"]',
    );
    const playerMarker = document.querySelector<HTMLElement>(
      ".pc-world-map-marker",
    );
    if (!oldLine || !newLine || !playerMarker) {
      throw new Error("Trail fixture is missing.");
    }
    return {
      oldestOpacity: Number(oldLine.getAttribute("opacity")),
      newestOpacity: Number(newLine.getAttribute("opacity")),
      oldestAgeRatio: Number(oldLine.dataset.ageRatio),
      newestAgeRatio: Number(newLine.dataset.ageRatio),
      newestColor: newLine.getAttribute("stroke"),
      markerColor: playerMarker.style.backgroundColor,
    };
  });
  expect(styles.oldestOpacity).toBeGreaterThanOrEqual(0.3);
  expect(styles.newestOpacity).toBeGreaterThan(styles.oldestOpacity);
  expect(styles.oldestAgeRatio).toBe(0);
  expect(styles.newestAgeRatio).toBe(1);
  expect(styles.newestColor).toBe("#22d3ee");
  expect(styles.markerColor).toBe("rgb(34, 211, 238)");

  async function trailWidthsAtZoom(zoom: number) {
    await page.locator(".pc-world-map-surface").evaluate((surface, value) => {
      surface.style.transform = `translate(-50%, -50%) scale(${value})`;
      const visual = surface.querySelector<HTMLElement>(
        ".pc-world-map-marker-visual",
      );
      if (visual) visual.style.transform = `scale(${1 / value})`;
    }, zoom);
    return {
      oldest: await oldest.evaluate(
        (line) => getComputedStyle(line).strokeWidth,
      ),
      newest: await newest.evaluate(
        (line) => getComputedStyle(line).strokeWidth,
      ),
    };
  }
  const fitWidths = await trailWidthsAtZoom(1);
  expect(Number.parseFloat(fitWidths.oldest)).toBeCloseTo(1.2, 1);
  expect(Number.parseFloat(fitWidths.newest)).toBeCloseTo(1.5, 1);
  expect(await trailWidthsAtZoom(2)).toEqual(fitWidths);
  expect(await trailWidthsAtZoom(4)).toEqual(fitWidths);

  await page.locator('[data-action="select-other"]').click();
  await expect(marker).toHaveAttribute("data-player-id", "user-b");
  await expect(newest).toHaveAttribute("stroke", "#a3e635");
  await expect(legend).toHaveAttribute(
    "style",
    /--pc-player-color:\s*#a3e635/i,
  );

  await page.locator('[data-action="center"]').click();
  await expect(marker).toHaveAttribute("data-centered", "true");
  await page.locator('[data-action="clear"]').click();
  await expect(page.locator(".pc-world-map-trail")).toHaveCount(0);
  await expect(page.locator(".pc-world-map-trail-legend")).toHaveCount(0);
});

test("player activity summary follows trail range, player, and clear controls", async ({
  page,
}) => {
  const stylesheetUrls = await productionStylesheetUrls(page);
  await page.setContent(`
    ${stylesheetUrls.map((url) => `<link rel="stylesheet" href="${url}">`).join("")}
    <main style="width: 700px; padding: 2rem;">
      <div class="pc-activity-summary" role="region" aria-label="Player activity summary">
        <p data-summary-executive>Exploring • Denalb • 1 hour</p>
        <h2>Activity classification</h2>
        <p data-summary-classification>Exploring</p>
        <h2>Operational flags</h2>
        <p>No notable events</p>
        <h2>Movement statistics</h2>
        <p><span>Time window</span> <span data-summary-range>1 hour</span></p>
        <h2>Timeline</h2>
        <p>12:01 PM Activity observed</p>
        <h2>Insights</h2>
        <p>Movement and stationary time were both observed.</p>
      </div>
      <button type="button" data-action="range">Use 15-minute range</button>
      <button type="button" data-action="player">Select Cattiva</button>
      <button type="button" data-action="clear-summary">Clear trail</button>
    </main>
  `);

  await page.evaluate(() => {
    document
      .querySelector('[data-action="range"]')
      ?.addEventListener("click", () => {
        const summary = document.querySelector("[data-summary-executive]");
        const range = document.querySelector("[data-summary-range]");
        if (summary)
          summary.textContent = "Highly Active • Denalb • 15 minutes";
        if (range) range.textContent = "15 minutes";
      });
    document
      .querySelector('[data-action="player"]')
      ?.addEventListener("click", () => {
        const summary = document.querySelector("[data-summary-executive]");
        if (summary) summary.textContent = "Mostly Idle • Cattiva • 15 minutes";
      });
    document
      .querySelector('[data-action="clear-summary"]')
      ?.addEventListener("click", () => {
        document.querySelector(".pc-activity-summary")?.remove();
      });
  });

  const summary = page.getByRole("region", {
    name: "Player activity summary",
  });
  await expect(summary).toContainText("Exploring");
  await expect(summary).toContainText("Movement statistics");
  await expect(summary).toContainText("Timeline");
  await expect(summary).toContainText("Insights");

  await page.locator('[data-action="range"]').click();
  await expect(summary.locator("[data-summary-range]")).toContainText(
    "15 minutes",
  );
  await expect(summary.locator("[data-summary-executive]")).toContainText(
    "Highly Active",
  );

  await page.locator('[data-action="player"]').click();
  await expect(summary.locator("[data-summary-executive]")).toContainText(
    "Cattiva",
  );

  await page.locator('[data-action="clear-summary"]').click();
  await expect(summary).toHaveCount(0);
});
