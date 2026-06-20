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
