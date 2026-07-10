import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pilotEvidenceFreshness, pilotEvidenceMaxAgeHours } from "./lib/pilot-evidence-freshness.mjs";

const execFileAsync = promisify(execFile);
const requireCurrentPilotEvidence = process.env.LUX_MVP_STATUS_REQUIRE_CURRENT_PILOT === "1";
const maxPilotAgeHours = pilotEvidenceMaxAgeHours();
const issues = [];
const warnings = [];
const legalLaunchGateIds = [
  "privacy_review",
  "terms_review"
];
const closeoutItemIds = [
  "inbox_notifications",
  ...legalLaunchGateIds
];

function issue(message) {
  issues.push(message);
}

function warn(message) {
  warnings.push(message);
}

function pilotEvidenceStale(message) {
  if (requireCurrentPilotEvidence) issue(message);
  else warn(message);
}

function hasSecretShape(raw) {
  return /\bre_[A-Za-z0-9_-]{16,}\b|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}/.test(raw);
}

const { stdout } = await execFileAsync(process.execPath, ["tools/report-mvp-status.mjs"], {
  env: { ...process.env, LUX_MVP_STATUS_JSON: "1" },
  timeout: 20000,
  maxBuffer: 1024 * 1024 * 4
});

if (hasSecretShape(stdout)) {
  issue("MVP status report appears to contain secret-shaped output");
}

let report = null;
try {
  report = JSON.parse(stdout);
} catch (error) {
  issue(`MVP status report did not return valid JSON: ${error?.message || String(error)}`);
}

if (report) {
  if (report.project !== "LuxVeritas.media") issue("project label mismatch");
  if (report.liveUrl !== "https://luxveritas.media") issue("liveUrl mismatch");
  if (!/^20\d{2}-\d{2}-\d{2}-phase-status$/.test(report.phaseStatus?.version || "")) issue("phase status version mismatch");
  if (report.phaseStatus?.currentPhase?.id !== "phase-5") issue("phase status current phase must be phase-5");
  if (report.phaseStatus?.currentPhase?.status !== "active_pilot") issue("phase status current phase must be active_pilot");
  const allowedPhasePilotStatuses = new Set(["pilot_ready", "pilot_ready_with_public_launch_blockers"]);
  if (!allowedPhasePilotStatuses.has(report.phaseStatus?.pilotStatus)) {
    issue("phase status pilotStatus must be pilot_ready or pilot_ready_with_public_launch_blockers");
  }
  if (report.phaseStatus?.pilotEvidence?.assetVersion !== report.build?.localAssetVersion) {
    pilotEvidenceStale("phase status pilot evidence asset version does not match local build; rerun the live pilot write gate after deploy");
  }
  if (report.phaseStatus?.pilotEvidence?.qaRunId !== report.pilotWriteEvidence?.qaRunId) issue("phase status pilot evidence qaRunId must match pilot write evidence");
  for (const capability of ["live_form_writes", "live_event_writes", "inbox_delivery", "private_handoff", "operator_reporting", "post_write_reconciliation"]) {
    if (!report.phaseStatus?.pilotEvidence?.verifiedCapabilities?.includes(capability)) issue(`phase status pilot evidence missing ${capability}`);
  }
  if (!/Phase 5 .*pilot prep.*active/i.test(report.phase || "")) issue(`phase summary mismatch: ${report.phase || "missing"}`);
  const localFreshness = pilotEvidenceFreshness(report.pilotWriteEvidence?.updatedAt, { maxAgeHours: maxPilotAgeHours });
  const phaseBlockers = Array.isArray(report.phaseStatus?.publicLaunchBlockers)
    ? report.phaseStatus.publicLaunchBlockers
    : [];
  const expectedLegalBlockerIds = [
    ["privacy_review", report.legal?.privacy?.status],
    ["terms_review", report.legal?.terms?.status]
  ].filter(([, status]) => status !== "approved").map(([id]) => id);
  for (const id of expectedLegalBlockerIds) {
    if (!phaseBlockers.includes(id)) {
      issue(`phase status must report ${id} as a public launch blocker while it is not approved`);
    }
  }
  for (const id of legalLaunchGateIds.filter((gateId) => !expectedLegalBlockerIds.includes(gateId))) {
    if (phaseBlockers.includes(id)) {
      issue(`phase status must not report ${id} as a public launch blocker after approval`);
    }
  }
  if (!localFreshness.ok && !phaseBlockers.includes("pilot_write_evidence_freshness")) {
    issue("phase status must report pilot write freshness as a public launch blocker when evidence is stale");
  }
  if (localFreshness.ok && phaseBlockers.includes("pilot_write_evidence_freshness")) {
    issue("phase status must not report pilot write freshness as active while evidence is fresh");
  }
  if (!Array.isArray(report.phaseStatus?.activeWorkstreams) || report.phaseStatus.activeWorkstreams.length < 4) {
    issue("phase status active workstreams missing");
  }
  if (!Array.isArray(report.phaseStatus?.deferredBoundaries) || !report.phaseStatus.deferredBoundaries.some((item) => item.id === "internal-bridge" && item.status === "deferred")) {
    issue("phase status must keep internal bridge deferred");
  }

  if (report.repo?.branch !== "main") issue(`repo branch is ${report.repo?.branch || "missing"}`);
  if (!/^[a-f0-9]{40}$/i.test(report.repo?.localSha || "")) issue("repo localSha missing or invalid");
  if (!/^[a-f0-9]{40}$/i.test(report.repo?.originSha || "")) issue("repo originSha missing or invalid");
  if (report.repo?.clean !== true) warn("repo is not clean in status report");
  if (report.repo?.alignedWithOrigin !== true) warn("repo is not aligned with origin in status report");

  const localVersion = report.build?.localAssetVersion || "";
  if (!localVersion) issue("local asset version missing");
  if (report.build?.liveManifestReadable === true && report.build?.liveAssetVersion !== localVersion) {
    warn(`live asset ${report.build?.liveAssetVersion || "missing"} does not match local ${localVersion}`);
  }
  if (report.build?.liveManifestReadable !== true) {
    warn(`live manifest not readable in this environment: ${report.build?.liveManifestError || "unavailable"}`);
  }

  if (report.legal?.privacy?.status !== "needs_review" && report.legal?.privacy?.status !== "approved") {
    issue(`unexpected privacy status ${report.legal?.privacy?.status || "missing"}`);
  }
  if (report.legal?.terms?.status !== "needs_review" && report.legal?.terms?.status !== "approved") {
    issue(`unexpected terms status ${report.legal?.terms?.status || "missing"}`);
  }

  if (report.media?.itemCount < 3) issue("media status should include audio, video, and stream items");
  for (const type of ["audio", "video", "stream"]) {
    if (!report.media?.byType?.[type]) issue(`media status missing ${type} item`);
  }
  if (Array.isArray(report.media?.missingRequiredSources) && report.media.missingRequiredSources.length) {
    issue(`required media sources missing: ${report.media.missingRequiredSources.join(", ")}`);
  }
  if (report.pilotWriteEvidence?.result !== "passed") issue("pilot write evidence result must be passed");
  if (report.pilotWriteEvidence?.assetVersion !== localVersion) {
    pilotEvidenceStale("pilot write evidence asset version does not match local asset version; rerun the live pilot write gate after deploy");
  }
  if (!localFreshness.ok) pilotEvidenceStale(localFreshness.message);
  if (report.pilotWriteEvidence?.freshness?.status !== localFreshness.status) issue("pilot write evidence freshness status mismatch");
  if (report.pilotWriteEvidence?.freshness?.maxAgeHours !== maxPilotAgeHours) issue("pilot write evidence freshness maxAgeHours mismatch");
  if (!/^\d{14}$/.test(report.pilotWriteEvidence?.qaRunId || "")) issue("pilot write evidence qaRunId missing or invalid");
  if (report.pilotWriteEvidence?.formCaptureIntents !== 11) issue("pilot write evidence must include 11 form capture intents");
  if (report.pilotWriteEvidence?.eventWrites !== 13) issue("pilot write evidence must include 13 event writes");
  if (report.pilotWriteEvidence?.inboxDeliveryRequired !== true) issue("pilot write evidence must require inbox delivery");
  if (report.pilotWriteEvidence?.operatorReportVerified !== true) issue("pilot write evidence must verify operator reporting");
  if (report.pilotWriteEvidence?.postWriteReconciliation !== true) issue("pilot write evidence must verify post-write reconciliation");
  if (report.pilotBugRegister?.status !== "no_known_blocking_bugs") issue("pilot bug register must report no known blocking bugs");
  if (report.pilotBugRegister?.decision !== "pilot_can_continue") issue("pilot bug register decision must allow pilot continuation");
  if (report.pilotBugRegister?.summary?.openBlockingBugs !== 0) issue("pilot bug register open blocking bug count must be zero");
  if (typeof report.pilotBugRegister?.summary?.openHighBugs !== "number") issue("pilot bug register open high bug count missing");
  if (report.pilotBugRegister?.evidence?.assetVersion !== localVersion) {
    pilotEvidenceStale("pilot bug register asset version does not match local asset version; rerun bug-register QA after deploy");
  }
  if (report.pilotBugRegister?.evidence?.pilotWriteQaRunId !== report.pilotWriteEvidence?.qaRunId) {
    issue("pilot bug register evidence qaRunId must match pilot write evidence");
  }
  if (report.pilotBugRegister?.evidence?.pilotFeedbackRoute !== "/pilot-feedback.html") {
    issue("pilot bug register feedback route must be /pilot-feedback.html");
  }
  if ((report.pilotBugRegister?.coverageCount || 0) < 7) issue("pilot bug register coverage count missing required surfaces");
  if ((report.pilotBugRegister?.checkCount || 0) < 6) issue("pilot bug register check count missing required regressions");
  if (Array.isArray(report.pilotBugRegister?.openBlockingBugs) && report.pilotBugRegister.openBlockingBugs.length) {
    issue(`pilot bug register has open blocking bugs: ${report.pilotBugRegister.openBlockingBugs.map((item) => item.id || "unknown").join(", ")}`);
  }

  const blocked = Array.isArray(report.launchGates?.blocked) ? report.launchGates.blocked : [];
  const blockedIds = new Set(blocked.map((gate) => gate.id));
  if (!report.launchGates?.blockedByCategory || typeof report.launchGates.blockedByCategory !== "object") {
    issue("launch gate blockedByCategory summary missing");
  }
  if (typeof report.launchGates?.codeBlockingCount !== "number") {
    issue("launch gate codeBlockingCount missing");
  }
  if (typeof report.launchGates?.externalApprovalCount !== "number") {
    issue("launch gate externalApprovalCount missing");
  }
  for (const id of expectedLegalBlockerIds) {
    if (!blockedIds.has(id)) warn(`expected current public-launch blocker ${id} is not reported as blocked`);
  }
  for (const gate of blocked) {
    if (!gate.label || !gate.category || !gate.owner || !gate.nextAction || !gate.verification) {
      issue(`blocked launch gate ${gate.id || "unknown"} lacks label, category, owner, nextAction, or verification`);
    }
  }

  const closeoutItems = Array.isArray(report.closeout?.items) ? report.closeout.items : [];
  if (!report.closeout?.updatedAt) issue("closeout updatedAt missing");
  if (!closeoutItems.length) issue("closeout items missing from MVP status report");
  const closeoutIds = new Set(closeoutItems.map((item) => item.id));
  for (const id of closeoutItemIds) {
    if (!closeoutIds.has(id)) issue(`closeout item ${id} missing from MVP status report`);
  }
  for (const item of closeoutItems) {
    if (!item.label || !item.owner || !item.gateId || !item.status) {
      issue(`closeout item ${item.id || "unknown"} lacks label, owner, gateId, or status`);
    }
    if (item.status === "closed" && (!item.evidenceReference || !item.closedAt || !item.closedBy)) {
      issue(`closed closeout item ${item.id || "unknown"} lacks evidenceReference, closedAt, or closedBy`);
    }
  }
  if (!report.closeout?.byStatus || typeof report.closeout.byStatus !== "object") {
    issue("closeout byStatus summary missing");
  }

  const allowedDecisions = new Set([
    "pilot-ready-with-public-launch-blockers",
    "operator-attention-needed-before-final-gate",
    "ready-for-final-release-gate"
  ]);
  if (!allowedDecisions.has(report.decision)) issue(`unexpected decision ${report.decision || "missing"}`);
  const allowedPilotStatuses = new Set(["pilot-ready", "operator-attention-needed"]);
  const allowedLaunchStatuses = new Set(["blocked-by-external-approval", "operator-attention-needed", "ready-for-final-release-gate"]);
  if (!allowedPilotStatuses.has(report.pilotStatus)) issue(`unexpected pilotStatus ${report.pilotStatus || "missing"}`);
  if (!allowedLaunchStatuses.has(report.publicLaunchStatus)) issue(`unexpected publicLaunchStatus ${report.publicLaunchStatus || "missing"}`);
  if (!Array.isArray(report.nextActions)) issue("nextActions missing");
  if (Array.isArray(report.nextActions)) {
    for (const action of report.nextActions) {
      if (!action.owner || !action.label || !action.action || !action.verification) {
        issue(`next action ${action.label || "unknown"} lacks owner, label, action, or verification`);
      }
    }
  }
}

if (warnings.length) {
  console.log("MVP status QA warnings:");
  for (const warning of warnings) console.log(`WARN ${warning}`);
}

if (issues.length) {
  console.error(`MVP status QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`MVP status QA passed${warnings.length ? ` with ${warnings.length} warning(s)` : ""}.`);
