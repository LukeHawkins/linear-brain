// Maintainer-only: rasterises an SVG to PNG via Playwright for quick preview.
// Usage: bun scripts/render-svg.ts <svg-path> <png-path>

import { chromium } from "playwright";
import { readFile } from "fs/promises";

const [svgPath, pngPath] = process.argv.slice(2);
if (!svgPath || !pngPath) {
  console.error("Usage: bun scripts/render-svg.ts <svg-path> <png-path>");
  process.exit(1);
}

const svg = await readFile(svgPath, "utf-8");
const html = `<!DOCTYPE html><html><head><style>body{margin:0;padding:0;background:transparent;}</style></head><body>${svg}</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 720 }, deviceScaleFactor: 2 });
await page.setContent(html);
await page.waitForSelector("svg");
const el = page.locator("svg").first();
await el.screenshot({ path: pngPath, omitBackground: true });
await browser.close();
console.log(`Wrote ${pngPath}`);
