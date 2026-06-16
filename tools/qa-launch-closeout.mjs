import { readFile } from "node:fs/promises";

const issues = [];
const [closeoutRaw, readinessRaw, docs] = await Promise.all([
  readFile("data/lux-launch-closeout.json", "utf8"),
  readFile("data/lux-launch-readiness.json", "utf8"),
  readFile("docs/launch-blocker-resolution.md", "utf8")
]);
const setter = await readFile("tools/set-launch-closeout-status.mjs", "utf8");

const closeout = JSON.parse(closeoutRaw);
const readiness = JSON.parse(readinessRaw);
const items = Array.isArray(closeout.items) ? closeout.items : [];
const gates = Array.isArray(readiness.gates) ? readiness.gates : [];
const gatesById = new Map(gates.map((gate) => [gate.id, gate]));
const requiredIds = [
  "www_redirect",
  "inbox_notifications",
  "privacy_review",
  "terms_review"
];
const allowedStatuses = new Set(["open", "closed", "blocked"]);

function issue(message) {
  issues.push(message);
}

if (closeout.schemaVersion !== "luxveritas.launch_closeout.v1") {
  issue("launch closeout schemaVersion mismatch");
}
if (!/do not store credentials/i.test(closeout.purpose || "")) {
  issue("launch closeout purpose must include no-secret rule");
}

const ids = new Set(items.map((item) => item.id));
for (const id of requiredIds) {
  if (!ids.has(id)) issue(`missing closeout item ${id}`);
}

for (const item of items) {
  if (!allowedStatuses.has(item.status)) issue(`${item.id}: invalid status ${item.status || "missing"}`);
  if (item.id !== item.gateId) issue(`${item.id}: gateId must match item id`);
  if (!gatesById.has(item.gateId)) issue(`${item.id}: gateId not found in launch readiness`);
  if (!item.label || !item.owner) issue(`${item.id}: missing label or owner`);
  if (!Array.isArray(item.requiredEvidence) || item.requiredEvidence.length < 3) {
    issue(`${item.id}: requiredEvidence must have at least 3 entries`);
  }
  if (!Array.isArray(item.commands) || !item.commands.length) {
    issue(`${item.id}: commands must be present`);
  }
  const gate = gatesById.get(item.gateId);
  if (gate?.status === "blocked" && item.status === "closed") {
    issue(`${item.id}: closeout cannot be closed while launch readiness gate is blocked`);
  }
  if (gate?.status === "ready" && item.status !== "closed") {
    issue(`${item.id}: closeout must be closed after launch readiness gate is ready`);
  }
  if (item.status === "closed") {
    if (!item.closedAt || !item.closedBy || !item.evidenceReference) {
      issue(`${item.id}: closed items require closedAt, closedBy, and evidenceReference`);
    }
  }
  if (item.status === "open") {
    if (item.closedAt || item.closedBy) issue(`${item.id}: open item should not have closedAt or closedBy`);
  }
}

for (const marker of [
  "www Domain",
  "Inbox Provider",
  "Privacy Approval",
  "Terms Approval",
  "node tools/qa-domain-readiness.mjs",
  "node tools/qa-provider-readiness.mjs",
  "node tools/qa-release-readiness.mjs",
  "node tools/set-launch-closeout-status.mjs",
  "LUX_CLOSEOUT_ITEM=www_redirect",
  "LUX_CLOSEOUT_DRY_RUN=1",
  "Launch readiness and closeout status must stay in sync"
]) {
  if (!docs.includes(marker)) issue(`launch blocker docs missing marker: ${marker}`);
}

for (const marker of [
  "LUX_CLOSEOUT_ITEM",
  "LUX_CLOSEOUT_STATUS",
  "LUX_CLOSEOUT_EVIDENCE",
  "LUX_CLOSEOUT_BY",
  "LUX_CLOSEOUT_DRY_RUN",
  "luxveritas.launch_closeout.v1"
]) {
  if (!setter.includes(marker)) issue(`set-launch-closeout-status.mjs missing marker: ${marker}`);
}

const rawCombined = `${closeoutRaw}\n${docs}`;
if (/re_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|REPORT_OPERATOR_TOKEN=.*[A-Za-z0-9_-]{12,}|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}/.test(rawCombined)) {
  issue("launch closeout/docs appear to contain secret-shaped data");
}

if (issues.length) {
  console.error(`Launch closeout QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`Launch closeout QA passed for ${items.length} item(s).`);
