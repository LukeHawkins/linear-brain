// Orchestrator for README screenshot generation.
//
// 1. Seeds ./data/demo.db with fake data (hard-gated to a demo path).
// 2. Builds the frontend.
// 3. Boots the Hono server on port 3001 with the demo DB.
// 4. Runs the Playwright capture script against it.
// 5. Kills the server.
//
// Usage: bun scripts/run-screenshots.ts
//
// Maintainer-only. Requires playwright devDep + `bun run screenshots:setup`.

import { spawn } from "child_process";
import { once } from "events";

const PORT = 3002;
const DB_PATH = "./data/demo.db";
const BASE_URL = `http://localhost:${PORT}`;

const demoEnv = {
  ...process.env,
  LINEAR_API_KEY: "demo",
  DATABASE_PATH: DB_PATH,
  PORT: String(PORT),
  // Jan poem feature intentionally disabled in public screenshots.
};

async function run(cmd: string, args: string[], env = demoEnv): Promise<void> {
  console.log(`[orchestrator] $ ${cmd} ${args.join(" ")}`);
  const proc = spawn(cmd, args, { env, stdio: "inherit" });
  const [code] = (await once(proc, "exit")) as [number | null];
  if (code !== 0) throw new Error(`${cmd} exited with code ${code}`);
}

async function main() {
  // 1. Seed
  await run("bun", ["scripts/seed-demo-data.ts"]);

  // 2. Build frontend
  console.log("[orchestrator] Building frontend...");
  await run("bun", ["run", "build:web"], process.env as typeof demoEnv);

  // 3. Boot server in background
  console.log(`[orchestrator] Starting server on ${BASE_URL}...`);
  const server = spawn("bun", ["src/index.ts"], {
    env: demoEnv,
    stdio: ["ignore", "inherit", "inherit"],
  });

  const cleanup = () => {
    if (!server.killed) {
      try { server.kill("SIGTERM"); } catch { /* noop */ }
    }
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("exit", cleanup);

  try {
    // 4. Capture (it waits for server readiness itself)
    await run("bun", ["scripts/capture-screenshots.ts"], { ...demoEnv, BASE_URL });
    console.log("[orchestrator] Screenshots captured.");
  } finally {
    // 5. Kill server
    cleanup();
  }
}

main().catch((err) => {
  console.error("[orchestrator] Failed:", err);
  process.exit(1);
});
