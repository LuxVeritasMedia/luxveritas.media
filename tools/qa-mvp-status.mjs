import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const issues = [];
const warnings = [];
const activeBlockedGateIds = [
  "privacy_review",
  "terms_review"
];
const closeoutItemIds = [
  "inbox_notifications",
  ...activeBlockedGateIds
];

function issue(message) {
  issues.push(message);
}

function warn(message) {
  warnings.push(message);
}

function hasSecretShape(raw) {
  return /re_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}/.test(raw);
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
  if (report.phaseStatus?.version !== "2026-06-20-phase-status") issue("phase status version mismatch");
  if (report.phaseStatus?.currentPhase?.id !== "phase-5") issue("phase status current phase must be phase-5");
  if (report.phaseStatus?.currentPhase?.status !== "active_pilot") issue("phase status current phase must be active_pilot");
  if (!/Phase 5 pilot prep is active/i.test(report.phase || "")) issue(`phase summary mismatch: ${report.phase || "missing"}`);
  if (!Array.isArray(report.phaseStatus?.publicLaunchBlockers) || !report.phaseStatus.publicLaunchBlockers.includes("privacy_review") || !report.phaseStatus.publicLaunchBlockers.includes("terms_review")) {
    issue("phase status must report Privacy and Terms as public launch blockers");
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
  if (report.pilotWriteEvidence?.assetVersion !== localVersion) issue("pilot write evidence asset version must match local asset version");
  if (!/^\d{14}$/.test(report.pilotWriteEvidence?.qaRunId || "")) issue("pilot write evidence qaRunId missing or invalid");
  if (report.pilotWriteEvidence?.formCaptureIntents !== 10) issue("pilot write evidence must include 10 form capture intents");
  if (report.pilotWriteEvidence?.eventWrites !== 11) issue("pilot write evidence must include 11 event writes");
  if (report.pilotWriteEvidence?.inboxDeliveryRequired !== true) issue("pilot write evidence must require inbox delivery");
  if (report.pilotWriteEvidence?.operatorReportVerified !== true) issue("pilot write evidence must verify operator reporting");
  if (report.pilotWriteEvidence?.postWriteReconciliation !== true) issue("pilot write evidence must verify post-write reconciliation");

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
  for (const id of activeBlockedGateIds) {
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
