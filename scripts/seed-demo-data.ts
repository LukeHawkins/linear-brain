// Seeds a demo SQLite database with fake data for README screenshots.
//
// Hard-gated so it can only run against a database whose path contains "demo".
// This prevents accidentally writing fake data into ./data/brain.db.
//
// Usage:
//   LINEAR_API_KEY=demo DATABASE_PATH=./data/demo.db bun scripts/seed-demo-data.ts

import { mkdirSync } from "fs";
import { dirname } from "path";

const dbPath = process.env.DATABASE_PATH ?? "";
if (!dbPath.toLowerCase().includes("demo")) {
  console.error(
    `[seed-demo] Refusing to run: DATABASE_PATH must contain "demo" (got: ${dbPath || "(unset)"}).\n` +
      `Set DATABASE_PATH=./data/demo.db to proceed.`,
  );
  process.exit(1);
}

// Ensure dir exists before db.ts tries to open the file.
mkdirSync(dirname(dbPath), { recursive: true });

const { db } = await import("../src/queue/db.ts");
const { createProposal, approveProposal, rejectProposal } = await import("../src/queue/proposals.ts");
const { saveSnapshot } = await import("../src/dashboard/store.ts");

// ---------- Reset ----------
db.run("DELETE FROM proposals");
db.run("DELETE FROM audit_log");
db.run("DELETE FROM dashboard_snapshots");
db.run("DELETE FROM insights");
db.run("DELETE FROM jan_poems");

// ---------- Demo team ----------
const TEAM_ID = "voyager";
const TEAM_NAME = "Voyager";

// Cycle: this week's Monday → two weeks later (so it reads as mid-cycle)
const now = new Date();
const day = now.getUTCDay();
const diff = day === 0 ? 6 : day - 1;
const cycleStart = new Date(now);
cycleStart.setUTCDate(cycleStart.getUTCDate() - diff - 7); // started last week
cycleStart.setUTCHours(0, 0, 0, 0);
const cycleEnd = new Date(cycleStart);
cycleEnd.setUTCDate(cycleEnd.getUTCDate() + 14);

// ---------- Members ----------
const members = [
  { id: "u_alex", name: "Alex Reyes", display_name: "Alex Reyes" },
  { id: "u_priya", name: "Priya Desai", display_name: "Priya Desai" },
  { id: "u_marcus", name: "Marcus Kim", display_name: "Marcus Kim" },
  { id: "u_yui", name: "Yui Tanaka", display_name: "Yui Tanaka" },
  { id: "u_sam", name: "Sam Okafor", display_name: "Sam Okafor" },
];

const [alex, priya, marcus, yui, sam] = members;

// ---------- Issues ----------
type Issue = {
  id: string;
  identifier: string;
  title: string;
  state_name: string;
  state_type: "triage" | "backlog" | "unstarted" | "started" | "completed" | "cancelled";
  assignee_name: string | null;
  assignee_id: string | null;
  estimate: number | null;
  priority: number;
  updated_at: string;
  completed_at: string | null;
  cycle_id: string | null;
};

const daysAgo = (n: number): string => {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
};

let issueCounter = 100;
const nextId = (): string => {
  issueCounter++;
  return `VOY-${issueCounter}`;
};

const mk = (
  title: string,
  state_type: Issue["state_type"],
  state_name: string,
  assignee: (typeof members)[number] | null,
  estimate: number | null,
  priority: number,
  updatedDaysAgo: number,
  completedDaysAgo: number | null = null,
): Issue => {
  const id = nextId();
  return {
    id,
    identifier: id,
    title,
    state_name,
    state_type,
    assignee_name: assignee?.name ?? null,
    assignee_id: assignee?.id ?? null,
    estimate,
    priority,
    updated_at: daysAgo(updatedDaysAgo),
    completed_at: completedDaysAgo != null ? daysAgo(completedDaysAgo) : null,
    cycle_id: "cycle-14",
  };
};

const issues: Issue[] = [
  // ---- In Progress ----
  mk("Checkout: inline card errors don't clear on retry", "started", "In Progress", alex!, 3, 2, 1),
  mk("Design: unify empty states across list views", "started", "In Progress", yui!, 5, 3, 0),
  mk("Onboarding: step 3 CTA not tappable on iOS Safari", "started", "In Progress", sam!, 2, 2, 2),
  mk("Export: CSV download truncates at 10k rows silently", "started", "In Progress", priya!, 5, 2, 1),
  mk("Mobile nav: drawer stays open after route change", "started", "In Progress", sam!, 3, 3, 0),
  mk("Billing: proration preview shows wrong cycle date", "started", "In Progress", marcus!, 5, 2, 3),

  // ---- In Review ----
  mk("Auth: add rate limit on password reset endpoint", "started", "In Review", marcus!, 3, 2, 1),
  mk("Settings: restore last-used tab on return", "started", "In Review", priya!, 2, 3, 2),
  mk("Design: dark mode audit for the settings screens", "started", "In Review", yui!, 5, 3, 1),
  mk("Search: debounce query input to reduce API hits", "started", "In Review", alex!, 2, 3, 4),

  // ---- Blocked ----
  mk("Webhooks: retry queue stalls when worker dies mid-job", "started", "Blocked", marcus!, 8, 1, 5),
  mk("Invites: accept flow 500s on expired token", "started", "Blocked", sam!, 3, 1, 6),

  // ---- Todo / Unstarted ----
  mk("Notifications: digest email preferences UI", "unstarted", "Todo", yui!, 5, 3, 7),
  mk("Dashboard: velocity chart overflows on narrow viewports", "unstarted", "Todo", alex!, 2, 3, 3),
  mk("Audit log: filter by actor + date range", "unstarted", "Todo", priya!, 3, 3, 8),
  mk("API: deprecate v1 listing endpoints with sunset header", "unstarted", "Todo", marcus!, 3, 3, 5),
  mk("Onboarding: add 'skip for now' on optional steps", "unstarted", "Todo", sam!, 2, 3, 4),
  mk("Design: refresh status tag palette for dark backgrounds", "unstarted", "Todo", yui!, 2, 4, 6),

  // ---- Backlog ----
  mk("Billing: annual plan upgrade flow", "backlog", "Backlog", null, 8, 3, 14),
  mk("Team: role-based permissions matrix", "backlog", "Backlog", null, 13, 3, 20),
  mk("Integrations: Slack digest formatting cleanup", "backlog", "Backlog", null, 3, 4, 18),
  mk("Perf: optimise initial dashboard load time", "backlog", "Backlog", null, 5, 3, 12),
  mk("A11y: focus ring contrast on primary buttons", "backlog", "Backlog", null, 2, 4, 25),

  // ---- Completed this week ----
  mk("Checkout: card expiry selector year order", "completed", "Done", alex!, 2, 3, 1, 1),
  mk("Design: new toast component variants", "completed", "Done", yui!, 3, 3, 2, 2),
  mk("Infra: bump Bun runtime to 1.3.10", "completed", "Done", marcus!, 1, 4, 3, 3),
  mk("Settings: wire up the 2FA toggle backend", "completed", "Done", priya!, 5, 2, 0, 0),
  mk("Onboarding: fix email confirmation copy typo", "completed", "Done", sam!, 1, 4, 4, 4),
  mk("Dashboard: member avatars missing alt text", "completed", "Done", yui!, 1, 4, 5, 5),

  // ---- Completed last week (for velocity bar) ----
  mk("Auth: remember device for 30 days option", "completed", "Done", marcus!, 5, 2, 8, 8),
  mk("Export: add JSON output format", "completed", "Done", priya!, 3, 3, 9, 9),
  mk("Design: loading skeleton for the proposals table", "completed", "Done", yui!, 2, 3, 10, 10),
  mk("Checkout: inline validation for postcode field", "completed", "Done", alex!, 2, 3, 11, 11),
  mk("Billing: invoice PDF footer branding", "completed", "Done", sam!, 2, 4, 12, 12),

  // ---- Completed two weeks ago ----
  mk("Onboarding: track completion rate per step", "completed", "Done", priya!, 3, 3, 15, 15),
  mk("Auth: consolidate session cookie names", "completed", "Done", marcus!, 3, 3, 16, 16),
  mk("Mobile nav: safe-area padding on notched devices", "completed", "Done", sam!, 2, 3, 17, 17),
];

// ---------- Member stats ----------
const memberStats = members.map((m) => {
  const mine = issues.filter((i) => i.assignee_id === m.id);
  const pointsIn = (fn: (i: Issue) => boolean) => mine.filter(fn).reduce((s, i) => s + (i.estimate ?? 0), 0);
  const weekStart = new Date(now);
  const wDay = weekStart.getUTCDay();
  const wDiff = wDay === 0 ? 6 : wDay - 1;
  weekStart.setUTCDate(weekStart.getUTCDate() - wDiff);
  weekStart.setUTCHours(0, 0, 0, 0);

  return {
    id: m.id,
    name: m.name,
    display_name: m.display_name,
    avatar_url: null,
    assigned_count: mine.length,
    points_todo: pointsIn((i) => i.state_type === "unstarted"),
    points_in_progress: pointsIn((i) => i.state_type === "started" && i.state_name === "In Progress"),
    points_in_review: pointsIn((i) => i.state_type === "started" && i.state_name === "In Review"),
    points_blocked: pointsIn((i) => i.state_name === "Blocked"),
    points_completed: mine
      .filter((i) => i.state_type === "completed" && i.completed_at && new Date(i.completed_at) >= weekStart)
      .reduce((s, i) => s + (i.estimate ?? 0), 0),
    issues: mine,
  };
});

// ---------- Grouped status ----------
const by_status = {
  triage: { count: 0, points: 0, issues: [] },
  backlog: {
    count: issues.filter((i) => i.state_type === "backlog").length,
    points: issues.filter((i) => i.state_type === "backlog").reduce((s, i) => s + (i.estimate ?? 0), 0),
    issues: issues.filter((i) => i.state_type === "backlog"),
  },
  unstarted: {
    count: issues.filter((i) => i.state_type === "unstarted").length,
    points: issues.filter((i) => i.state_type === "unstarted").reduce((s, i) => s + (i.estimate ?? 0), 0),
    issues: issues.filter((i) => i.state_type === "unstarted"),
  },
  started: {
    count: issues.filter((i) => i.state_type === "started").length,
    points: issues.filter((i) => i.state_type === "started").reduce((s, i) => s + (i.estimate ?? 0), 0),
    issues: issues.filter((i) => i.state_type === "started"),
  },
  completed: {
    count: issues.filter((i) => i.state_type === "completed").length,
    points: issues.filter((i) => i.state_type === "completed").reduce((s, i) => s + (i.estimate ?? 0), 0),
    issues: issues.filter((i) => i.state_type === "completed"),
  },
  cancelled: { count: 0, points: 0, issues: [] },
};

const weekStart = new Date(now);
const wDay = weekStart.getUTCDay();
const wDiff = wDay === 0 ? 6 : wDay - 1;
weekStart.setUTCDate(weekStart.getUTCDate() - wDiff);
weekStart.setUTCHours(0, 0, 0, 0);

const pointsCompletedWeek = issues
  .filter((i) => i.state_type === "completed" && i.completed_at && new Date(i.completed_at) >= weekStart)
  .reduce((s, i) => s + (i.estimate ?? 0), 0);

// ---------- Blockers + stale ----------
const blockers = issues
  .filter((i) => i.state_name === "Blocked")
  .map((i) => ({
    issue: i,
    reason: i.identifier === "VOY-111"
      ? "Depends on external vendor fix"
      : "Waiting on product decision",
    days_stale: i.identifier === "VOY-111" ? 5 : 6,
  }));

const stale = issues
  .filter((i) => {
    if (i.state_type !== "started" && i.state_type !== "unstarted") return false;
    const updated = new Date(i.updated_at);
    const diffDays = (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 5;
  })
  .slice(0, 3)
  .map((i) => ({
    issue: i,
    reason: "No movement in 5+ days",
    days_stale: Math.floor((now.getTime() - new Date(i.updated_at).getTime()) / (1000 * 60 * 60 * 24)),
  }));

// ---------- Snapshot ----------
const snapshot = {
  generated_at: now.toISOString(),
  team_id: TEAM_ID,
  team_name: TEAM_NAME,
  cycle: {
    id: "cycle-14",
    name: "Cycle 14",
    starts_at: cycleStart.toISOString(),
    ends_at: cycleEnd.toISOString(),
    progress: 0.55,
    scope_total: by_status.started.count + by_status.unstarted.count + by_status.completed.count,
    scope_completed: by_status.completed.count,
  },
  summary: {
    total_issues: issues.filter((i) => i.state_type !== "backlog").length,
    points_planned: by_status.started.points + by_status.unstarted.points + by_status.completed.points,
    points_completed: pointsCompletedWeek,
    points_in_progress: memberStats.reduce((s, m) => s + m.points_in_progress, 0),
    points_in_review: memberStats.reduce((s, m) => s + m.points_in_review, 0),
  },
  by_status,
  members: memberStats,
  blockers,
  stale,
};

saveSnapshot(TEAM_ID, snapshot as unknown as Parameters<typeof saveSnapshot>[1]);
console.log(`[seed-demo] Dashboard snapshot saved (${snapshot.summary.total_issues} issues)`);

// ---------- Proposals ----------

// Pending proposals (what a morning might look like)
const pending = [
  {
    type: "update_issue" as const,
    summary: "[tidy] VOY-131 — Rewrite title + add estimate",
    reasoning:
      "Draft title 'fix the thing in checkout lol' violates the Subject: Action convention. Scope suggests a 3-point fix based on similar retry-banner issues shipped previously.",
    payload: {
      issueId: "voy-131-uuid",
      identifier: "VOY-131",
      title: "Checkout: retry banner clears stale amount on re-submit",
      description:
        "When a card is declined and the user retries with a new card, the retry banner still displays the previous amount for ~500ms before updating. Reproduces on Chrome + Safari.\n\nRelated: VOY-101",
      estimate: 3,
      labelsToAdd: ["bug", "checkout"],
      labelsToRemove: ["DRAFT"],
    },
  },
  {
    type: "update_issue" as const,
    summary: "[audit] VOY-118 — Missing estimate + assignee",
    reasoning:
      "Ticket is in the current cycle, marked high priority, but has no estimate and no assignee. Based on scope (copy + CSS), suggest 2 pts. Suggest assigning to Yui based on design workload.",
    payload: {
      issueId: "voy-118-uuid",
      identifier: "VOY-118",
      estimate: 2,
      assigneeId: "u_yui",
    },
  },
  {
    type: "add_comment" as const,
    summary: "[audit] VOY-111 — Flag as related to VOY-107",
    reasoning:
      "Both tickets describe webhook retry behaviour under different failure modes. They should share context — likely a single fix.",
    payload: {
      issueId: "voy-111-uuid",
      identifier: "VOY-111",
      body:
        "Related to VOY-107 — both concern the worker retry queue. Recommend scoping together before splitting the work.",
    },
  },
];

for (const p of pending) {
  createProposal(p);
}

// Historical proposals — mix of approved + rejected
const historicalApproved = [
  {
    type: "update_issue" as const,
    summary: "[tidy] VOY-120 — Add missing description",
    reasoning: "Draft ticket had only a title. Drafted a description based on the comment thread.",
    payload: { issueId: "voy-120-uuid", identifier: "VOY-120", description: "..." },
  },
  {
    type: "update_issue" as const,
    summary: "[audit] VOY-115 — Fix label: 'Bug' → 'bug'",
    reasoning: "Label casing inconsistent with team conventions.",
    payload: { issueId: "voy-115-uuid", identifier: "VOY-115", labelsToAdd: ["bug"], labelsToRemove: ["Bug"] },
  },
];

const historicalRejected = [
  {
    type: "update_issue" as const,
    summary: "[audit] VOY-124 — Suggest splitting into two tickets",
    reasoning: "Ticket covers both a backend fix and a UI polish. Proposed splitting.",
    payload: { issueId: "voy-124-uuid", identifier: "VOY-124", description: "..." },
  },
];

for (const p of historicalApproved) {
  const created = createProposal(p);
  approveProposal(created.id);
  // Mark executed directly
  db.run(
    `UPDATE proposals SET status = 'executed', executed_at = ?, execution_result = ? WHERE id = ?`,
    [daysAgo(1), JSON.stringify({ success: true }), created.id],
  );
}

for (const p of historicalRejected) {
  const created = createProposal(p);
  rejectProposal(created.id, "Keeping as-is for now — will split later if it bloats.");
}

console.log(`[seed-demo] Proposals seeded (3 pending, ${historicalApproved.length + historicalRejected.length} historical)`);

// ---------- Insights ----------
const insightCurrent = `### Summary
Cycle 14 is 55% through the window with 62% of scope closed — slightly ahead. The bottleneck this week is review, not progress: Priya and Marcus both have multiple tickets sitting in review for 2+ days. Sam is carrying the highest in-progress load of anyone and should be watched.

### Cycle Progress
Cycle 14 runs ${cycleStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} → ${cycleEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}. Scope total 22 issues, 14 closed. At this point we'd expect ~12 closed on a linear burndown — so we are marginally ahead, but three of the remaining issues are blocked.

### Focus Areas
1. **Unblock VOY-111 and VOY-117** — both have been blocked ≥5 days. VOY-111 is waiting on a vendor fix; escalate or route around. VOY-117 needs a product call from one of the leads.
2. **Clear the review queue** — 5 tickets in review across Priya, Marcus, Alex. Either do a joint review block this morning or reassign reviewers.
3. **Rebalance Sam** — 4 in-progress tickets is too many parallel threads. Pause one and push it back to Todo.

### Team Performance
- **Alex Reyes** — 3 tickets in flight (2 in progress, 1 review). On track, reasonable pace.
- **Priya Desai** — 5 tickets total. Review backlog building up. Slightly overloaded on review.
- **Marcus Kim** — 4 tickets including the critical webhook block. Blocked work is dragging on throughput.
- **Yui Tanaka** — Design load balanced. 5 pts in progress, 5 pts in review. Healthy.
- **Sam Okafor** — 4 in progress tickets. Spread thin. Consider reducing WIP.

### Risks & Blockers
- **VOY-111** (webhook retry queue) — blocked 5 days, highest priority in cycle
- **VOY-117** (invite flow 500) — blocked 6 days, no owner on the decision
- **VOY-108** (billing proration) — moving slowly, may roll over to Cycle 15

### Recommendations
1. Escalate VOY-111 to the vendor today — it has knocked on effects for VOY-107.
2. Run a 30-minute joint review pass at 10am to clear the review column.
3. Move one of Sam's in-progress tickets back to Todo to reduce WIP.
4. Plan Cycle 15 scope assuming VOY-108 rolls over.`;

const insightOlder = `### Summary
Cycle 14 started strong with five points closed in the first two days. Scope is tight and achievable. Biggest risk is the webhook migration (VOY-111), which depends on a vendor fix landing.

### Cycle Progress
Cycle 14 just kicked off. Scope looks right-sized for the team.

### Focus Areas
1. Front-load the checkout work — it unblocks three downstream tickets.
2. Get design review cadence set early for the empty-states work.
3. Spike the webhook migration so we know whether VOY-111 is doable in-cycle.

### Team Performance
Everyone is starting the cycle with reasonable load. Marcus is taking the heaviest technical piece.

### Recommendations
1. Book a 30-min design critique slot for mid-week.
2. Confirm vendor ETA on the webhook fix by Wednesday.`;

const id1 = `ins_${Date.now().toString(36)}_01`;
const id2 = `ins_${Date.now().toString(36)}_02`;
db.run(
  `INSERT INTO insights (id, created_at, team_id, content, issue_count) VALUES (?, ?, ?, ?, ?)`,
  [id1, daysAgo(0), TEAM_ID, insightCurrent, issues.filter((i) => i.state_type !== "cancelled").length],
);
db.run(
  `INSERT INTO insights (id, created_at, team_id, content, issue_count) VALUES (?, ?, ?, ?, ?)`,
  [id2, daysAgo(7), TEAM_ID, insightOlder, 30],
);

console.log("[seed-demo] Insights seeded (2)");

// ---------- Demo poems (fictional character — real in-joke name is config-driven) ----------
const janPoem1 = `Four tickets deep in the weeds,
the drawer that will not close,
the CTA that will not tap.
Safari wins the battle, not the war.
You will ship it anyway.`;

const janPoem2 = `Blocked tickets gather like weather.
Someone stares into the invite flow's abyss.
500, it says. 500, always 500.
A token has forgotten who it is.
We believe in you. Mostly.`;

db.run(
  `INSERT INTO jan_poems (id, created_at, poem) VALUES (?, ?, ?)`,
  [`pm_${Date.now().toString(36)}_01`, daysAgo(0), janPoem1],
);
db.run(
  `INSERT INTO jan_poems (id, created_at, poem) VALUES (?, ?, ?)`,
  [`pm_${Date.now().toString(36)}_02`, daysAgo(3), janPoem2],
);

console.log("[seed-demo] Demo poems seeded (2)");
console.log(`[seed-demo] Done. Database: ${dbPath}`);
