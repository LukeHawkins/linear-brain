// Internal-only easter egg. Gated behind ENABLE_JAN_POEM + JAN_NAME env vars
// so it's invisible in any install that hasn't opted in. Not documented in
// .env.example on purpose — the feature is a team in-joke, not a product.

import { gatherBoard, type BoardIssue } from "./gather-board.ts";
import { db } from "../queue/db.ts";
import { config } from "../config.ts";

function generateId(): string {
  const timestamp = Date.now().toString(36).toUpperCase().padStart(10, "0");
  const random = Math.random().toString(36).slice(2, 14).toUpperCase().padStart(12, "0");
  return `${timestamp}${random}`;
}

function buildPrompt(janIssues: BoardIssue[], otherSample: BoardIssue[], janName: string): string {
  const janLines = janIssues.length > 0
    ? janIssues.map((i) => `  - ${i.identifier} [${i.stateName}] ${i.title}${i.estimate ? ` (${i.estimate} pts)` : ""}`).join("\n")
    : "  (no active tickets assigned)";

  const otherLines = otherSample.length > 0
    ? otherSample.map((i) => `  - ${i.identifier} [${i.stateName}] ${i.title} — ${i.assigneeName ?? "Unassigned"}`).join("\n")
    : "  (none)";

  return `You are writing a short, quirky, satirical, and motivational poem for a teammate named ${janName}. It is an in-joke on our team.

Keep it to 4–8 short lines. Haiku-adjacent, not strictly 5-7-5. Playful. Satirical where it fits. Warm underneath.

Focus mostly on ${janName}'s tickets. You can reference other teammates' work for colour or a gentle jab, but ${janName} is the star.

The tone should be: a friend teasing a friend while secretly meaning every word of encouragement.

## ${janName}'s active tickets
${janLines}

## Other tickets on the board (for colour)
${otherLines}

## Output rules
- Output ONLY the poem. No title, no preamble, no explanation, no markdown fences.
- Each line on its own line.
- 4-8 lines total.`;
}

export interface JanPoemRow {
  id: string;
  created_at: string;
  poem: string;
}

export function getJanPoems(limit = 20): JanPoemRow[] {
  return db
    .query<JanPoemRow, number>("SELECT * FROM jan_poems ORDER BY created_at DESC LIMIT ?")
    .all(limit);
}

export async function runJanPoem(): Promise<{ id: string; created_at: string; poem: string }> {
  console.log("[jan-poem] Generating poem for", config.janName);

  const { issues } = await gatherBoard();

  const active = issues.filter((i) => i.stateType !== "completed" && i.stateType !== "cancelled" && i.stateType !== "canceled");
  const janIssues = active.filter((i) => i.assigneeName === config.janName);
  const others = active.filter((i) => i.assigneeName !== config.janName);

  // Shuffle others and take up to 8 for colour
  const shuffled = [...others].sort(() => Math.random() - 0.5).slice(0, 8);

  const prompt = buildPrompt(janIssues, shuffled, config.janName);

  const proc = Bun.spawn(["claude", "-p", prompt, "--output-format", "json", "--model", "haiku"], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    console.error("[jan-poem] Claude process failed:", stderr);
    throw new Error(`Claude process exited with code ${exitCode}`);
  }

  let poem: string;
  try {
    const envelope = JSON.parse(output) as { result: string };
    poem = envelope.result.trim();
  } catch (err) {
    console.error("[jan-poem] Failed to parse Claude output:", output.slice(0, 500));
    throw new Error(`Failed to parse Claude response: ${String(err)}`);
  }

  const id = generateId();
  const created_at = new Date().toISOString();

  db.run(`INSERT INTO jan_poems (id, created_at, poem) VALUES (?, ?, ?)`, [id, created_at, poem]);

  // Keep only the most recent 20
  db.run(`
    DELETE FROM jan_poems
    WHERE id NOT IN (SELECT id FROM jan_poems ORDER BY created_at DESC LIMIT 20)
  `);

  console.log(`[jan-poem] Poem ${id} saved (${janIssues.length} Jan tickets referenced)`);
  return { id, created_at, poem };
}
