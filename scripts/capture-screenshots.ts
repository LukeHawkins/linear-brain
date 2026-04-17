// Captures README screenshots against a running dev build of Linear Brain.
//
// Produces two kinds of assets:
//   1. Full-page captures wrapped in a macOS-style window chrome.
//   2. Element-level "excerpt" close-ups for callouts in the README.
//
// The runner script in package.json is responsible for seeding, building,
// booting, and shutting down the server.
//
// Usage:
//   bun scripts/capture-screenshots.ts

import { chromium, type Page } from "playwright";
import { mkdirSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3002";
const OUT_DIR = join(process.cwd(), "docs", "screenshots");
const VIEWPORT = { width: 1200, height: 820 };

mkdirSync(OUT_DIR, { recursive: true });

async function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} did not respond within ${timeoutMs}ms`);
}

function macChromeHtml(imageBase64: string, title: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: transparent; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  body { padding: 24px; display: inline-block; }
  .window {
    border-radius: 12px;
    overflow: hidden;
    background: #0c0c0c;
    border: 1px solid #27272a;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
  }
  .chrome {
    height: 38px;
    background: linear-gradient(#1a1a1d, #141417);
    border-bottom: 1px solid #27272a;
    display: flex;
    align-items: center;
    padding: 0 14px;
    gap: 10px;
    position: relative;
  }
  .dots { display: flex; gap: 8px; }
  .dot {
    width: 12px; height: 12px; border-radius: 50%;
    display: inline-block;
  }
  .r { background: #ff5f57; }
  .y { background: #febc2e; }
  .g { background: #28c840; }
  .title {
    position: absolute; left: 0; right: 0; text-align: center;
    color: #a1a1aa; font-size: 12px; letter-spacing: 0.02em;
    pointer-events: none;
  }
  img { display: block; }
</style>
</head>
<body>
  <div class="window" id="window">
    <div class="chrome">
      <div class="dots"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span></div>
      <div class="title">${title}</div>
    </div>
    <img src="data:image/png;base64,${imageBase64}" />
  </div>
</body>
</html>`;
}

async function wrapInMacChrome(
  page: Page,
  rawPngPath: string,
  outPath: string,
  title: string,
): Promise<void> {
  const base64 = (await readFile(rawPngPath)).toString("base64");
  await page.setContent(macChromeHtml(base64, title), { waitUntil: "load" });
  await page.waitForSelector("#window img");
  // Wait for the embedded image to finish decoding
  await page.evaluate(async () => {
    const img = document.querySelector<HTMLImageElement>("#window img")!;
    if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));
  });
  const el = page.locator("#window");
  await el.screenshot({ path: outPath, omitBackground: true });
}

async function main() {
  console.log(`[capture] Waiting for server at ${BASE_URL}...`);
  await waitForServer(`${BASE_URL}/api/config/flags`);

  const proposalsRes = await fetch(`${BASE_URL}/api/proposals?status=pending`);
  const proposals = (await proposalsRes.json()) as { id: string }[];
  const firstProposalId = proposals[0]?.id;
  if (!firstProposalId) throw new Error("No pending proposals found — seed data missing?");

  console.log("[capture] Launching Chromium...");
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });
  const page = await context.newPage();
  const wrapPage = await context.newPage();

  const rawShot = async (name: string, opts?: { fullPage?: boolean }): Promise<string> => {
    const path = join(OUT_DIR, `_raw_${name}.png`);
    await page.screenshot({ path, fullPage: opts?.fullPage ?? false });
    return path;
  };

  const elementShot = async (selector: string, name: string): Promise<void> => {
    const loc = page.locator(selector).first();
    await loc.waitFor({ state: "visible", timeout: 5000 });
    const path = join(OUT_DIR, `${name}.png`);
    await loc.screenshot({ path });
    console.log(`[capture] Wrote ${path} (excerpt)`);
  };

  // ---------- 1. Dashboard ----------
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Voyager", { timeout: 10_000 });
  await page.waitForTimeout(500);
  const rawDash = await rawShot("dashboard", { fullPage: true });
  await wrapInMacChrome(wrapPage, rawDash, join(OUT_DIR, "dashboard.png"), "Linear Brain — Dashboard");
  console.log("[capture] Wrote dashboard.png");

  // Excerpts from the dashboard
  await elementShot(".ant-card:has-text('Weekly Velocity')", "excerpt-velocity");
  await elementShot(".ant-card:has-text('Team')", "excerpt-team-table");

  // ---------- 2. Proposals ----------
  await page.goto(`${BASE_URL}/proposals`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Proposals");
  await page.waitForTimeout(400);
  const rawProp = await rawShot("proposals", { fullPage: false });
  await wrapInMacChrome(wrapPage, rawProp, join(OUT_DIR, "proposals.png"), "Linear Brain — Proposals");
  console.log("[capture] Wrote proposals.png");

  // Excerpt: the action buttons row (Audit Board / Tidy Drafts / Approve All)
  await elementShot(".ant-flex:has(.ant-btn:has-text('Audit Board'))", "excerpt-proposal-actions");

  // ---------- 3. Proposal detail ----------
  await page.goto(`${BASE_URL}/proposals/${firstProposalId}`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Reasoning");
  await page.waitForTimeout(400);
  const rawDetail = await rawShot("proposal-detail", { fullPage: true });
  await wrapInMacChrome(wrapPage, rawDetail, join(OUT_DIR, "proposal-detail.png"), "Linear Brain — Proposal");
  console.log("[capture] Wrote proposal-detail.png");

  // Excerpt: just the inside of the proposal card (summary + reasoning + changes)
  await elementShot(".ant-card", "excerpt-proposal-changes");

  // ---------- 4. Insights ----------
  await page.goto(`${BASE_URL}/insights`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Insights");
  await page.waitForTimeout(400);
  const rawIns = await rawShot("insights", { fullPage: true });
  await wrapInMacChrome(wrapPage, rawIns, join(OUT_DIR, "insights.png"), "Linear Brain — Insights");
  console.log("[capture] Wrote insights.png");

  // ---------- Cleanup raw captures ----------
  // Keep only the macOS-wrapped versions + excerpts in docs/screenshots/.
  for (const name of ["dashboard", "proposals", "proposal-detail", "insights"]) {
    const raw = join(OUT_DIR, `_raw_${name}.png`);
    await writeFile(raw, ""); // truncate
  }
  // Delete the empty raw files
  const { unlink } = await import("fs/promises");
  for (const name of ["dashboard", "proposals", "proposal-detail", "insights"]) {
    try { await unlink(join(OUT_DIR, `_raw_${name}.png`)); } catch { /* noop */ }
  }

  await browser.close();
  console.log("[capture] Done.");
}

main().catch((err) => {
  console.error("[capture] Failed:", err);
  process.exit(1);
});
