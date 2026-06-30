import { readFile } from "node:fs/promises";

const issues = [];

function issue(message) {
  issues.push(message);
}

function hasSecretShape(raw) {
  return /\bre_[A-Za-z0-9_-]{16,}\b|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}/.test(raw);
}

function countOpen(items, severities = null) {
  return items.filter((item) => {
    const status = item.status || "open";
    const severity = item.severity || "standard";
    const open = !["fixed", "closed", "resolved"].includes(status);
    return open && (!severities || severities.has(severity));
  }).length;
}

const [registerRaw, pilotMatrixRaw, pilotWriteRaw, buildRaw, workflowRaw, finalAuditRaw, todoRaw] = await Promise.all([
  readFile("data/lux-pilot-bug-register.json", "utf8"),
  readFile("data/lux-pilot-test-matrix.json", "utf8"),
  readFile("data/lux-pilot-write-evidence.json", "utf8"),
  readFile("data/lux-build-manifest.json", "utf8"),
  readFile(".github/workflows/firebase-hosting-live.yml", "utf8"),
  readFile(".github/workflows/final-release-audit.yml", "utf8"),
  readFile("TODO.md", "utf8")
]);

if (hasSecretShape(registerRaw)) issue("pilot bug register appears to contain secret-shaped data");

const register = JSON.parse(registerRaw);
const pilotMatrix = JSON.parse(pilotMatrixRaw);
const pilotWrite = JSON.parse(pilotWriteRaw);
const build = JSON.parse(buildRaw);
const items = Array.isArray(register.items) ? register.items : [];
const checks = Array.isArray(register.checks) ? register.checks : [];
const coverageEvidence = Array.isArray(register.coverageEvidence) ? register.coverageEvidence : [];
const triageRules = Array.isArray(register.triageRules) ? register.triageRules : [];
const requiredCoverage = Array.isArray(pilotMatrix.requiredCoverage) ? pilotMatrix.requiredCoverage : [];

if (register.schemaVersion !== "luxveritas.pilot_bug_register.v1") {
  issue("pilot bug register schemaVersion mismatch");
}
if (!register.version || !register.updatedAt || !register.status || !register.decision) {
  issue("pilot bug register missing version, updatedAt, status, or decision");
}
if (register.status !== "no_known_blocking_bugs") {
  issue(`pilot bug register status is ${register.status || "missing"}, expected no_known_blocking_bugs`);
}
if (!["pilot_can_continue", "pilot_blocked", "needs_triage"].includes(register.decision)) {
  issue(`pilot bug register decision is invalid: ${register.decision || "missing"}`);
}

const openBlocking = countOpen(items, new Set(["blocking", "critical"]));
const openHigh = countOpen(items, new Set(["high"]));
const openTotal = countOpen(items);
const knownIssues = items.length;

if (register.summary?.openBlockingBugs !== openBlocking) {
  issue(`openBlockingBugs summary mismatch: ${register.summary?.openBlockingBugs ?? "missing"} != ${openBlocking}`);
}
if (register.summary?.openHighBugs !== openHigh) {
  issue(`openHighBugs summary mismatch: ${register.summary?.openHighBugs ?? "missing"} != ${openHigh}`);
}
if (register.summary?.openTotalBugs !== openTotal) {
  issue(`openTotalBugs summary mismatch: ${register.summary?.openTotalBugs ?? "missing"} != ${openTotal}`);
}
if (register.summary?.knownIssues !== knownIssues) {
  issue(`knownIssues summary mismatch: ${register.summary?.knownIssues ?? "missing"} != ${knownIssues}`);
}
if (openBlocking > 0) issue(`pilot bug register has ${openBlocking} open blocking bug(s)`);
if (register.decision === "pilot_can_continue" && openBlocking > 0) {
  issue("pilot_can_continue decision is invalid while blocking bugs are open");
}
if (register.decision === "pilot_blocked" && openBlocking === 0) {
  issue("pilot_blocked decision is invalid without open blocking bugs");
}

if (register.evidence?.assetVersion !== (build.assetVersion || build.version || "")) {
  issue("pilot bug register assetVersion does not match build manifest");
}
if (register.evidence?.pilotWriteQaRunId !== pilotWrite.qaRunId) {
  issue("pilot bug register pilotWriteQaRunId does not match pilot write evidence");
}
if (register.evidence?.pilotWriteEvidenceFile !== "data/lux-pilot-write-evidence.json") {
  issue("pilot bug register must reference data/lux-pilot-write-evidence.json");
}
if (register.evidence?.pilotFeedbackRoute !== "/pilot-feedback.html") {
  issue("pilot bug register must reference /pilot-feedback.html");
}
if (pilotWrite.result !== "passed") {
  issue("pilot write evidence must be passed before bug register can be release-supporting evidence");
}

const coverage = new Set(coverageEvidence.map((item) => item.coverage));
for (const item of requiredCoverage) {
  if (!coverage.has(item)) issue(`pilot bug register missing coverage evidence for ${item}`);
}
for (const item of coverageEvidence) {
  if (!item.status || !item.evidence) issue(`coverage evidence ${item.coverage || "unknown"} missing status or evidence`);
}

for (const severity of ["blocking", "high", "standard"]) {
  if (!triageRules.some((rule) => rule.severity === severity && rule.definition && rule.releaseRule)) {
    issue(`pilot bug register missing ${severity} triage rule`);
  }
}

const requiredChecks = new Set([
  "submit_freeze_regression",
  "dead_button_regression",
  "live_capture_regression",
  "live_event_regression",
  "media_regression",
  "operator_report_regression"
]);
for (const id of requiredChecks) {
  const check = checks.find((item) => item.id === id);
  if (!check) issue(`pilot bug register missing check ${id}`);
  else if (check.status !== "passed" || !check.command) issue(`pilot bug register check ${id} must be passed with a command`);
}

for (const item of items) {
  if (!item.id || !item.label || !item.severity || !item.status || !item.owner || !item.nextAction) {
    issue(`bug item ${item.id || "unknown"} lacks id, label, severity, status, owner, or nextAction`);
  }
}

for (const marker of [
  "node tools/qa-pilot-bug-register.mjs"
]) {
  if (!workflowRaw.includes(marker)) issue(`firebase-hosting-live.yml missing ${marker}`);
  if (!finalAuditRaw.includes(marker)) issue(`final-release-audit.yml missing ${marker}`);
}
if (!todoRaw.includes("Add no-secret pilot bug register")) {
  issue("TODO.md missing pilot bug register completion marker");
}

if (issues.length) {
  console.error(`Pilot bug register QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`Pilot bug register QA passed: ${openBlocking} open blocking bug(s), ${openHigh} open high bug(s), ${knownIssues} known issue(s).`);
