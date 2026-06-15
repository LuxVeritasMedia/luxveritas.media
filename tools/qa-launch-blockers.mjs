import { readFile } from "node:fs/promises";

const issues = [];
const [launchRaw, todo, handoff, blockerPacket, runbook] = await Promise.all([
  readFile("data/lux-launch-readiness.json", "utf8"),
  readFile("TODO.md", "utf8"),
  readFile("docs/production-release-handoff.md", "utf8"),
  readFile("docs/launch-blocker-resolution.md", "utf8"),
  readFile("docs/final-launch-runbook.md", "utf8")
]);

const launch = JSON.parse(launchRaw);
const gates = Array.isArray(launch.gates) ? launch.gates : [];
const gatesById = new Map(gates.map((gate) => [gate.id, gate]));
const allowedStatuses = new Set(["ready", "blocked"]);
const publicLaunchGateIds = [
  "media_sources",
  "inbox_notifications",
  "private_handoff",
  "operator_reporting",
  "privacy_review",
  "terms_review",
  "www_redirect"
];

const blockerChecks = [
  {
    id: "www_redirect",
    label: "www Domain",
    todoMarker: "Configure www.luxveritas.media DNS and Hosting redirect",
    handoffMarker: "`www.luxveritas.media` DNS and Firebase Hosting redirect are not configured.",
    runbookMarker: "`www.luxveritas.media` does not resolve over HTTPS."
  },
  {
    id: "inbox_notifications",
    label: "Inbox Provider",
    todoMarker: "Configure and verify email provider runtime secret `RESEND_API_KEY`",
    handoffMarker: "`RESEND_API_KEY` must be set to a real approved provider key.",
    runbookMarker: "Live form writes do not send to `info@luxveritas.media`."
  },
  {
    id: "privacy_review",
    label: "Privacy Approval",
    todoMarker: "Legal review: Privacy",
    handoffMarker: "Privacy page needs legal/business approval.",
    runbookMarker: "Privacy or Terms still show `needs_review`."
  },
  {
    id: "terms_review",
    label: "Terms Approval",
    todoMarker: "Legal review: Terms",
    handoffMarker: "Terms page needs legal/business approval.",
    runbookMarker: "Privacy or Terms still show `needs_review`."
  }
];

function issue(message) {
  issues.push(message);
}

function uncheckedTodoIncludes(marker) {
  return todo.split("\n").some((line) => line.includes("- [ ]") && line.includes(marker));
}

function checkedTodoIncludes(marker) {
  return todo.split("\n").some((line) => line.includes("- [x]") && line.includes(marker));
}

if (launch.schemaVersion && launch.schemaVersion !== "luxveritas.launch_readiness.v1") {
  issue(`unexpected launch readiness schemaVersion ${launch.schemaVersion}`);
}

for (const id of publicLaunchGateIds) {
  const gate = gatesById.get(id);
  if (!gate) {
    issue(`missing required public-launch gate ${id}`);
    continue;
  }
  if (!allowedStatuses.has(gate.status)) issue(`${id}: invalid status ${gate.status || "missing"}`);
  if (gate.requiredForPublicLaunch !== true) issue(`${id}: requiredForPublicLaunch must be true`);
  for (const field of ["label", "category", "nextAction", "owner", "blockerType", "verification"]) {
    if (!gate[field]) issue(`${id}: missing ${field}`);
  }
}

for (const check of blockerChecks) {
  const gate = gatesById.get(check.id);
  if (!gate) continue;
  if (!blockerPacket.includes(`## Blocker`) || !blockerPacket.includes(check.label)) {
    issue(`docs/launch-blocker-resolution.md missing blocker section for ${check.label}`);
  }
  if (gate.status === "blocked") {
    if (!uncheckedTodoIncludes(check.todoMarker)) issue(`TODO.md must leave ${check.todoMarker} unchecked while ${check.id} is blocked`);
    if (!handoff.includes(check.handoffMarker)) issue(`production-release-handoff.md missing active blocker marker for ${check.id}`);
    if (!runbook.includes(check.runbookMarker)) issue(`final-launch-runbook.md missing do-not-ship marker for ${check.id}`);
  }
  if (gate.status === "ready" && uncheckedTodoIncludes(check.todoMarker)) {
    issue(`TODO.md still shows ${check.todoMarker} unchecked after ${check.id} is ready`);
  }
  if (gate.status === "ready" && !checkedTodoIncludes(check.todoMarker)) {
    issue(`TODO.md should show ${check.todoMarker} checked after ${check.id} is ready`);
  }
  if (gate.status === "ready" && handoff.includes(check.handoffMarker)) {
    issue(`production-release-handoff.md still describes ${check.id} as an active blocker after it is ready`);
  }
}

const blockedRequired = gates.filter((gate) => gate.requiredForPublicLaunch === true && gate.status === "blocked");
for (const gate of blockedRequired) {
  if (!gate.nextAction || !gate.verification) issue(`${gate.id}: blocked gate needs nextAction and verification`);
}

if (/re_[A-Za-z0-9_-]{8,}/.test(`${handoff}\n${blockerPacket}\n${runbook}`)) {
  issue("launch blocker docs appear to contain a real Resend key");
}
if (/LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}|REPORT_OPERATOR_TOKEN=.*[A-Za-z0-9_-]{12,}/.test(`${handoff}\n${blockerPacket}\n${runbook}`)) {
  issue("launch blocker docs appear to contain a private operator token");
}

if (issues.length) {
  console.error(`Launch blocker QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`Launch blocker QA passed for ${gates.length} gate(s), ${blockedRequired.length} active public-launch blocker(s).`);
