# scripts/

Maintainer-only tooling. Users cloning Linear Brain to run it do **not** need to touch any of this.

## Screenshot generation (for the README)

The README screenshots under `docs/screenshots/` are regenerated from fake data via Playwright. The seed data lives entirely in `./data/demo.db` — your real `./data/brain.db` is never touched.

**First time on a new machine:**

```bash
bun run screenshots:setup
```

This downloads the Chromium binary Playwright uses (~300MB). It's only needed once.

**Regenerate screenshots:**

```bash
bun run screenshots
```

That runner does, in order:

1. Seeds `./data/demo.db` (hard-gated — the seed script refuses to run unless `DATABASE_PATH` contains `"demo"`).
2. Builds the frontend.
3. Starts the server on port `3001` with the demo DB and `ENABLE_JAN_POEM=true`.
4. Runs Playwright to capture `dashboard.png`, `proposals.png`, `proposal-detail.png`, `insights.png`, and `jan-poem.png` into `docs/screenshots/`.
5. Kills the server.

The `./data/demo.db` file is gitignored. Commit the PNGs under `docs/screenshots/`.

## Previewing SVG diagrams

`render-svg.ts` rasterises an SVG to PNG so you can sanity-check a diagram without opening a browser:

```bash
bun scripts/render-svg.ts docs/diagrams/flow.svg /tmp/flow.png
```

## Other scripts

The other files in this folder are one-off dumps/utilities used during development — `dump-issues.ts`, `board-analysis.ts`, etc. They hit the real Linear API and are not wired into any workflow.
