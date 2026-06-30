import { readFile } from "node:fs/promises";
import { pilotEvidenceFreshness, pilotEvidenceMaxAgeHours } from "./lib/pilot-evidence-freshness.mjs";

const issues = [];
const warnings = [];
const strict = process.env.LUX_PILOT_WRITE_EVIDENCE_STRICT === "1";
const maxAgeHours = pilotEvidenceMaxAgeHours();
const requiredChecks = new Set([
  "Operator Environment",
  "MVP Status",
  "Deploy Status",
  "Domain Readiness",
  "Provider Readiness",
  "Live Site",
  "Live Assets",
  "Live Media Sources",
  "Live Browser Flows",
  "Live Operator Report",
  "Release Readiness",
  "Live Form Write Matrix",
  "Live Event Write Matrix",
  "Post-Write Report Reconciliation"
]);

function issue(message) {
  issues.push(message);
}

function warn(message) {
  warnings.push(message);
}

function staleEvidence(message) {
  if (strict) issue(message);
  else warn(message);
}

function secretShape(value) {
  return /re_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}|REPORT_OPERATOR_TOKEN=.*[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{16,}/i.test(value);
}

const [raw, manifestRaw, runbook, handoff] = await Promise.all([
  readFile("data/lux-pilot-write-evidence.json", "utf8"),
  readFile("data/lux-build-manifest.json", "utf8"),
  readFile("docs/final-launch-runbook.md", "utf8"),
  readFile("docs/production-release-handoff.md", "utf8")
]);

if (secretShape(raw)) issue("pilot write evidence appears to contain secret-shaped data");

let evidence = null;
try {
  evidence = JSON.parse(raw);
} catch (error) {
  issue(`pilot write evidence JSON is invalid: ${error?.message || String(error)}`);
}

const manifest = JSON.parse(manifestRaw);
const expectedAssetVersion = manifest.assetVersion || manifest.version || "";

if (evidence) {
  if (evidence.schemaVersion !== "luxveritas.pilot_write_evidence.v1") issue("pilot write evidence schemaVersion mismatch");
  if (evidence.liveUrl !== "https://luxveritas.media") issue("pilot write evidence liveUrl mismatch");
  if (!expectedAssetVersion || evidence.assetVersion !== expectedAssetVersion) {
    staleEvidence(`pilot write evidence assetVersion ${evidence.assetVersion || "missing"} does not match current build ${expectedAssetVersion || "missing"}; rerun the live pilot write gate after deploy`);
  }
  if (!/^\d{14}$/.test(evidence.qaRunId || "")) issue("pilot write evidence qaRunId must be YYYYMMDDHHMMSS");
  if (evidence.command !== "LUX_PILOT_WRITE_TESTS=1 node tools/qa-pilot-write-gate.mjs") issue("pilot write evidence command mismatch");
  if (evidence.result !== "passed") issue("pilot write evidence result must be passed");
  if (!Date.parse(evidence.updatedAt || "")) issue("pilot write evidence updatedAt missing or invalid");
  const freshness = pilotEvidenceFreshness(evidence.updatedAt, { maxAgeHours });
  if (!freshness.ok) staleEvidence(freshness.message);

  const writeEvidence = evidence.writeEvidence || {};
  if (writeEvidence.formCaptureIntents !== 11) issue("pilot write evidence must cover 11 form capture intents");
  if (writeEvidence.eventWrites !== 12) issue("pilot write evidence must cover 12 event writes");
  if (writeEvidence.inboxDeliveryRequired !== true) issue("pilot write evidence must require inbox delivery");
  if (writeEvidence.operatorReportVerified !== true) issue("pilot write evidence must verify operator reporting");
  if (writeEvidence.postWriteReconciliation !== true) issue("pilot write evidence must verify post-write reconciliation");

  for (const [key, value] of Object.entries(evidence.coverage || {})) {
    if (value !== true) issue(`pilot write evidence coverage ${key} must be true`);
  }
  for (const key of [
    "domainReadiness",
    "providerReadiness",
    "liveSite",
    "liveAssets",
    "liveMediaSources",
    "liveBrowserFlows",
    "liveOperatorReport",
    "releaseReadinessChecked"
  ]) {
    if (evidence.coverage?.[key] !== true) issue(`pilot write evidence missing coverage ${key}`);
  }

  const checks = new Set(Array.isArray(evidence.passedChecks) ? evidence.passedChecks : []);
  for (const check of requiredChecks) {
    if (!checks.has(check)) issue(`pilot write evidence missing passed check ${check}`);
  }

  const allowedBlockers = new Set(Array.isArray(evidence.knownPublicLaunchBlockersAllowed) ? evidence.knownPublicLaunchBlockersAllowed : []);
  for (const id of ["privacy_review", "terms_review"]) {
    if (!allowedBlockers.has(id)) issue(`pilot write evidence missing allowed legal blocker ${id}`);
  }

  for (const [name, doc] of [["final launch runbook", runbook], ["production release handoff", handoff]]) {
    for (const marker of [
      "data/lux-pilot-write-evidence.json",
      "node tools/qa-pilot-write-evidence.mjs",
      evidence.qaRunId || "missing-qa-run-id"
    ]) {
      if (!doc.includes(marker)) issue(`${name} missing pilot write evidence marker: ${marker}`);
    }
  }
}

if (issues.length) {
  console.error(`Pilot write evidence QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

if (warnings.length) {
  console.warn("Pilot write evidence QA warnings:");
  for (const item of warnings) console.warn(`- ${item}`);
}

console.log(`Pilot write evidence QA passed${warnings.length ? ` with ${warnings.length} warning(s)` : ""}.`);
