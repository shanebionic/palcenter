import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const cssDirectory = path.resolve(".next/static/css");
const entries = await readdir(cssDirectory, { recursive: true });
const cssFiles = entries.filter((entry) => entry.endsWith(".css"));

if (cssFiles.length === 0) {
  throw new Error(`No production CSS assets were found in ${cssDirectory}.`);
}

const css = (
  await Promise.all(
    cssFiles.map((entry) => readFile(path.join(cssDirectory, entry), "utf8")),
  )
).join("\n");

const requiredSelectors = [
  ".pc-world-map-viewport",
  ".pc-world-map-surface",
  ".pc-world-map-marker",
  ".pc-world-map-trail-segment",
  ".pc-world-map-trail-legend",
  ".pc-activity-summary",
];

for (const selector of requiredSelectors) {
  if (!css.includes(selector)) {
    throw new Error(
      `Production CSS is missing ${selector}. Confirm app/layout.tsx imports globals.css.`,
    );
  }
}

console.info(
  `Verified ${requiredSelectors.length} world-map selectors across ${cssFiles.length} production CSS assets.`,
);
