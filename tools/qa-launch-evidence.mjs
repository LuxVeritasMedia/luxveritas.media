import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const issues = [];

function issue(message) {
  issues.push(message);
}

function secretShape(value) {
  return /\bre_[A-Za-z0-9_-]{16,}\b|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}|REPORT_OPERATOR_TOKEN=.*[A-Za-z0-9_-]{12,}/.test(value);
}

function topEntries(source = {}, limit = 8) {
  return Object.entries(source || {})
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function sameEntries(actual = [], expected = []) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

const actionInventory = JSON.parse(await readFile("data/lux-action-inventory.json", "utf8"));
const pilotWriteEvidence = JSON.parse(await readFile("data/lux-pilot-write-evidence.json", "utf8"));
const pilotBugRegister = JSON.parse(await readFile("data/lux-pilot-bug-register.json", "utf8"));
const { stdout: openApprovalsRaw } = await execFileAsync(process.execPath, ["tools/report-open-approvals.mjs"], {
  env: { ...process.env, LUX_OPEN_APPROVALS_JSON: "1" },
  timeout: 30000,
  maxBuffer: 1024 * 1024 * 4
});
const openApprovals = JSON.parse(openApprovalsRaw);

const { stdout: markdown } = await execFileAsync(process.execPath, ["tools/export-launch-evidence.mjs"], {
  timeout: 90000,
  maxBuffer: 1024 * 1024 * 8
});

const { stdout: jsonRaw } = await execFileAsync(process.execPath, ["tools/export-launch-evidence.mjs"], {
  env: { ...process.env, LUX_EVIDENCE_FORMAT: "json" },
  timeout: 90000,
  maxBuffer: 1024 * 1024 * 8
});

if (secretShape(markdown) || secretShape(jsonRaw)) issue("launch evidence output appears to contain secret-shaped data");

for (const marker of [
  "# Lux Veritas Launch Evidence",
  "Decision:",
  "Asset version:",
  "## Action Coverage",
  `Actions: ${actionInventory.actionCount}`,
  `Route surfaces: ${actionInventory.routeCount}`,
  "link_click",
  "lead_accepted",
  "## Pilot Test Matrix",
  "## Pilot Write Evidence",
  `QA run ID: ${pilotWriteEvidence.qaRunId}`,
  "Freshness:",
  "Form capture intents: 11",
  "Event writes: 12",
  "## Pilot Bug Register",
  `Version: ${pilotBugRegister.version}`,
  "Status: no_known_blocking_bugs",
  "Decision: pilot_can_continue",
  "Open blocking bugs: 0",
  "submit_freeze_regression passed",
  "## Launch Gates",
  "## Open Approvals",
  "Decision: external_approvals_pending",
  "Public launch blockers: 2",
  "Functions Deploy IAM",
  "External Workflow Target",
  "## Closeout",
  "## Command Summaries",
  "Inbox Notifications",
  "Privacy Review",
  "Terms Review",
  "WWW Redirect"
]) {
  if (!markdown.includes(marker)) issue(`markdown evidence missing marker: ${marker}`);
}

let evidence = null;
try {
  evidence = JSON.parse(jsonRaw);
} catch (error) {
  issue(`JSON evidence is invalid: ${error?.message || String(error)}`);
}

if (evidence) {
  if (evidence.schemaVersion !== "luxveritas.launch_evidence.v1") issue("evidence schemaVersion mismatch");
  if (evidence.project !== "LuxVeritas.media") issue("evidence project mismatch");
  if (evidence.liveUrl !== "https://luxveritas.media") issue("evidence liveUrl mismatch");
  if (evidence.phaseStatusVersion !== "2026-06-28-phase-status") issue("evidence phaseStatusVersion mismatch");
  if (evidence.currentPhase?.id !== "phase-5" || evidence.currentPhase?.status !== "active_pilot") issue("evidence current phase mismatch");
  if (!evidence.assetVersion) issue("evidence assetVersion missing");
  if (!evidence.media?.itemCount || evidence.media.itemCount < 3) issue("evidence media item count should include MVP audio/video/stream");
  if (evidence.actionInventory?.version !== actionInventory.version) issue("evidence action inventory version mismatch");
  if (evidence.actionInventory?.buildAssetVersion !== evidence.assetVersion) issue("evidence action inventory build version must match asset version");
  if (evidence.actionInventory?.actionCount !== actionInventory.actionCount) issue("evidence action inventory actionCount mismatch");
  if (evidence.actionInventory?.routeCount !== actionInventory.routeCount) issue("evidence action inventory routeCount mismatch");
  if (!sameEntries(evidence.actionInventory?.topActionTypes, topEntries(actionInventory.summary?.byType))) {
    issue("evidence action inventory topActionTypes does not match source inventory");
  }
  if (!sameEntries(evidence.actionInventory?.topReportingEvents, topEntries(actionInventory.summary?.byReportingEvent))) {
    issue("evidence action inventory topReportingEvents does not match source inventory");
  }
  if (!sameEntries(evidence.actionInventory?.topRouteSurfaces, topEntries(actionInventory.summary?.byRoute))) {
    issue("evidence action inventory topRouteSurfaces does not match source inventory");
  }
  for (const [field, required] of [
    ["byType", ["link_click", "form_open", "media_action", "operator_report_action"]],
    ["byReportingEvent", ["link_click", "lead_accepted", "media_action", "report_action"]],
    ["byRoute", ["index.html", "music.html", "portal/reporting.html"]]
  ]) {
    const source = actionInventory.summary?.[field] || {};
    for (const label of required) {
      if (!source[label]) issue(`source action inventory ${field} missing ${label}`);
    }
  }
  if (evidence.pilotTestMatrix?.status !== "active") issue("evidence pilot test matrix status should be active");
  if (!evidence.pilotTestMatrix?.scenarioCount || evidence.pilotTestMatrix.scenarioCount < 9) {
    issue("evidence pilot test matrix should include required pilot scenarios");
  }
  const coverage = new Set(evidence.pilotTestMatrix?.requiredCoverage || []);
  for (const item of ["public_capture", "media_player", "fan_reaction", "operator_reporting", "launch_gates"]) {
    if (!coverage.has(item)) issue(`evidence pilot test matrix missing coverage ${item}`);
  }
  if (evidence.pilotWriteEvidence?.schemaVersion !== "luxveritas.pilot_write_evidence.v1") issue("evidence pilot write schemaVersion mismatch");
  if (!/^\d{14}$/.test(evidence.pilotWriteEvidence?.qaRunId || "")) issue("evidence pilot write qaRunId missing or invalid");
  if (evidence.pilotWriteEvidence?.result !== "passed") issue("evidence pilot write result must be passed");
  if (!evidence.pilotWriteEvidence?.freshness || typeof evidence.pilotWriteEvidence.freshness !== "object") {
    issue("evidence pilot write freshness missing");
  }
  if (!["fresh", "stale", "future", "invalid"].includes(evidence.pilotWriteEvidence?.freshness?.status || "")) {
    issue("evidence pilot write freshness status invalid");
  }
  if (evidence.pilotWriteEvidence?.formCaptureIntents !== 11) issue("evidence pilot write must include 11 capture intents");
  if (evidence.pilotWriteEvidence?.eventWrites !== 12) issue("evidence pilot write must include 12 event writes");
  if (evidence.pilotWriteEvidence?.inboxDeliveryRequired !== true) issue("evidence pilot write must require inbox delivery");
  if (evidence.pilotWriteEvidence?.operatorReportVerified !== true) issue("evidence pilot write must verify operator report");
  if (evidence.pilotWriteEvidence?.postWriteReconciliation !== true) issue("evidence pilot write must verify post-write reconciliation");
  if (evidence.pilotBugRegister?.schemaVersion !== "luxveritas.pilot_bug_register.v1") issue("evidence pilot bug register schemaVersion mismatch");
  if (evidence.pilotBugRegister?.version !== pilotBugRegister.version) issue("evidence pilot bug register version mismatch");
  if (evidence.pilotBugRegister?.status !== "no_known_blocking_bugs") issue("evidence pilot bug register status must report no known blocking bugs");
  if (evidence.pilotBugRegister?.decision !== "pilot_can_continue") issue("evidence pilot bug register decision must allow pilot continuation");
  if (evidence.pilotBugRegister?.summary?.openBlockingBugs !== 0) issue("evidence pilot bug register open blocking bugs must be zero");
  if (evidence.pilotBugRegister?.summary?.openHighBugs !== pilotBugRegister.summary?.openHighBugs) issue("evidence pilot bug register high count mismatch");
  if (evidence.pilotBugRegister?.evidence?.assetVersion !== evidence.assetVersion) issue("evidence pilot bug register asset version must match launch evidence asset version");
  if (evidence.pilotBugRegister?.evidence?.pilotWriteQaRunId !== pilotWriteEvidence.qaRunId) issue("evidence pilot bug register qaRunId must match pilot write evidence");
  if (evidence.pilotBugRegister?.evidence?.pilotFeedbackRoute !== "/pilot-feedback.html") issue("evidence pilot bug register route must be /pilot-feedback.html");
  const bugCoverage = new Set((evidence.pilotBugRegister?.coverageEvidence || []).map((item) => item.coverage));
  for (const item of ["public_capture", "media_player", "fan_reaction", "portal_capture", "operator_reporting", "launch_gates", "private_workflow_readiness"]) {
    if (!bugCoverage.has(item)) issue(`evidence pilot bug register missing coverage ${item}`);
  }
  const bugChecks = new Set((evidence.pilotBugRegister?.checks || []).map((item) => item.id));
  for (const item of ["submit_freeze_regression", "dead_button_regression", "live_capture_regression", "operator_report_regression"]) {
    if (!bugChecks.has(item)) issue(`evidence pilot bug register missing check ${item}`);
  }
  if (Array.isArray(evidence.pilotBugRegister?.openItems) && evidence.pilotBugRegister.openItems.some((item) => ["blocking", "critical"].includes(item.severity || ""))) {
    issue("evidence pilot bug register contains open blocking/critical items");
  }
  const blocked = Array.isArray(evidence.launchGates?.blocked) ? evidence.launchGates.blocked : [];
  for (const id of ["privacy_review", "terms_review"]) {
    if (!blocked.some((gate) => gate.id === id)) issue(`evidence missing current blocked gate ${id}`);
  }
  if (evidence.openApprovals?.decision !== openApprovals.decision) issue("evidence open approvals decision mismatch");
  if (evidence.openApprovals?.counts?.publicLaunchBlockers !== openApprovals.counts?.publicLaunchBlockers) {
    issue("evidence open approvals publicLaunchBlockers mismatch");
  }
  if (evidence.openApprovals?.counts?.totalOpenOrConditional !== openApprovals.counts?.totalOpenOrConditional) {
    issue("evidence open approvals totalOpenOrConditional mismatch");
  }
  const approvalItems = Array.isArray(evidence.openApprovals?.approvals) ? evidence.openApprovals.approvals : [];
  for (const id of ["privacy_review", "terms_review", "functions_deploy_iam", "external_workflow_target"]) {
    if (!approvalItems.some((item) => item.id === id)) issue(`evidence missing open approval ${id}`);
  }
  for (const id of ["privacy_review", "terms_review"]) {
    const item = approvalItems.find((entry) => entry.id === id);
    if (item && item.blocksPublicLaunch !== true) issue(`evidence open approval ${id} should block public launch`);
  }
  for (const id of ["functions_deploy_iam", "external_workflow_target"]) {
    const item = approvalItems.find((entry) => entry.id === id);
    if (item && item.blocksPublicLaunch !== false) issue(`evidence open approval ${id} should not block public launch`);
  }
  const closeoutItems = Array.isArray(evidence.closeout?.items) ? evidence.closeout.items : [];
  if (!evidence.closeout?.updatedAt) issue("evidence closeout updatedAt missing");
  if (!evidence.closeout?.byStatus || typeof evidence.closeout.byStatus !== "object") issue("evidence closeout byStatus missing");
  for (const id of ["inbox_notifications", "privacy_review", "terms_review", "www_redirect"]) {
    if (!closeoutItems.some((item) => item.id === id)) issue(`evidence missing closeout item ${id}`);
  }
  if (!evidence.commandSummaries?.mvpStatus?.lines?.length) issue("evidence missing MVP status summary lines");
}

if (issues.length) {
  console.error(`Launch evidence QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log("Launch evidence QA passed.");
