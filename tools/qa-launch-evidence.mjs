import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const issues = [];

function issue(message) {
  issues.push(message);
}

function secretShape(value) {
  return /re_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}|REPORT_OPERATOR_TOKEN=.*[A-Za-z0-9_-]{12,}/.test(value);
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
  "QA run ID: 20260620235930",
  "Form capture intents: 11",
  "Event writes: 11",
  "## Launch Gates",
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
  if (evidence.phaseStatusVersion !== "2026-06-20-phase-status") issue("evidence phaseStatusVersion mismatch");
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
  if (evidence.pilotWriteEvidence?.assetVersion !== evidence.assetVersion) issue("evidence pilot write assetVersion must match launch evidence assetVersion");
  if (evidence.pilotWriteEvidence?.qaRunId !== "20260620235930") issue("evidence pilot write qaRunId mismatch");
  if (evidence.pilotWriteEvidence?.result !== "passed") issue("evidence pilot write result must be passed");
  if (evidence.pilotWriteEvidence?.formCaptureIntents !== 11) issue("evidence pilot write must include 11 capture intents");
  if (evidence.pilotWriteEvidence?.eventWrites !== 11) issue("evidence pilot write must include 11 event writes");
  if (evidence.pilotWriteEvidence?.inboxDeliveryRequired !== true) issue("evidence pilot write must require inbox delivery");
  if (evidence.pilotWriteEvidence?.operatorReportVerified !== true) issue("evidence pilot write must verify operator report");
  if (evidence.pilotWriteEvidence?.postWriteReconciliation !== true) issue("evidence pilot write must verify post-write reconciliation");
  const blocked = Array.isArray(evidence.launchGates?.blocked) ? evidence.launchGates.blocked : [];
  for (const id of ["privacy_review", "terms_review"]) {
    if (!blocked.some((gate) => gate.id === id)) issue(`evidence missing current blocked gate ${id}`);
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
