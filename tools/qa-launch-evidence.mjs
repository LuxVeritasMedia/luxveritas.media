import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const issues = [];
const warnings = [];

function issue(message) {
  issues.push(message);
}

function warn(message) {
  warnings.push(message);
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
const privateWorkflowSelection = JSON.parse(await readFile("docs/private-workflow-selection.json", "utf8"));
const { stdout: openApprovalsRaw } = await execFileAsync(process.execPath, ["tools/report-open-approvals.mjs"], {
  env: { ...process.env, LUX_OPEN_APPROVALS_JSON: "1" },
  timeout: 30000,
  maxBuffer: 1024 * 1024 * 4
});
const openApprovals = JSON.parse(openApprovalsRaw);
const { stdout: approvalDecisionFormsRaw } = await execFileAsync(process.execPath, ["tools/export-open-approval-decision-forms.mjs"], {
  env: { ...process.env, LUX_APPROVAL_FORMS_FORMAT: "json" },
  timeout: 30000,
  maxBuffer: 1024 * 1024 * 4
});
const approvalDecisionForms = JSON.parse(approvalDecisionFormsRaw);

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
  "Reporting channels:",
  "consented_event",
  "server_capture",
  "protected_operator",
  "local_receipt",
  "Reporting status:",
  "declared",
  "## Pilot Test Matrix",
  "## Pilot Write Evidence",
  `QA run ID: ${pilotWriteEvidence.qaRunId}`,
  "Freshness:",
  "Form capture intents: 11",
  "Event writes: 13",
  "## Pilot Bug Register",
  `Version: ${pilotBugRegister.version}`,
  "Status: no_known_blocking_bugs",
  "Decision: pilot_can_continue",
  "Open blocking bugs: 0",
  "submit_freeze_regression passed",
  "## External Workflow Readiness",
  "Current target: firebase_handoff",
  "Recommended first external target: google_workspace",
  "approval required: yes",
  "## Launch Gates",
  "## Open Approvals",
  `Decision: ${openApprovals.decision}`,
  `Public launch blockers: ${openApprovals.counts?.publicLaunchBlockers ?? "unknown"}`,
  "Functions Deploy IAM",
  "External Workflow Target",
  "## Approval Decision Forms",
  "Schema: luxveritas.open_approval_decision_forms.v1",
  "Forms available: 7",
  "Privacy Review (privacy_review)",
  "Terms Review (terms_review)",
  "version keys",
  "## Closeout",
  "## Command Summaries",
  "### Preview Helper",
  "Preview helper QA checked:",
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
  if (!/^20\d{2}-\d{2}-\d{2}-phase-status$/.test(evidence.phaseStatusVersion || "")) issue("evidence phaseStatusVersion mismatch");
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
  if (!sameEntries(evidence.actionInventory?.topReportingChannels, topEntries(actionInventory.summary?.byReportingChannel))) {
    issue("evidence action inventory topReportingChannels does not match source inventory");
  }
  if (JSON.stringify(evidence.actionInventory?.reportingStatus || {}) !== JSON.stringify(actionInventory.summary?.byReportingStatus || {})) {
    issue("evidence action inventory reportingStatus does not match source inventory");
  }
  if (evidence.actionInventory?.reportingStatus?.declared !== actionInventory.actionCount) {
    issue("evidence action inventory declared reporting status must match action count");
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
  if (evidence.pilotWriteEvidence?.eventWrites !== 13) issue("evidence pilot write must include 13 event writes");
  if (evidence.pilotWriteEvidence?.inboxDeliveryRequired !== true) issue("evidence pilot write must require inbox delivery");
  if (evidence.pilotWriteEvidence?.operatorReportVerified !== true) issue("evidence pilot write must verify operator report");
  if (evidence.pilotWriteEvidence?.postWriteReconciliation !== true) issue("evidence pilot write must verify post-write reconciliation");
  if (evidence.pilotBugRegister?.schemaVersion !== "luxveritas.pilot_bug_register.v1") issue("evidence pilot bug register schemaVersion mismatch");
  if (evidence.pilotBugRegister?.version !== pilotBugRegister.version) issue("evidence pilot bug register version mismatch");
  if (evidence.pilotBugRegister?.status !== "no_known_blocking_bugs") issue("evidence pilot bug register status must report no known blocking bugs");
  if (evidence.pilotBugRegister?.decision !== "pilot_can_continue") issue("evidence pilot bug register decision must allow pilot continuation");
  if (evidence.pilotBugRegister?.summary?.openBlockingBugs !== 0) issue("evidence pilot bug register open blocking bugs must be zero");
  if (evidence.pilotBugRegister?.summary?.openHighBugs !== pilotBugRegister.summary?.openHighBugs) issue("evidence pilot bug register high count mismatch");
  if (evidence.pilotBugRegister?.evidence?.assetVersion !== evidence.assetVersion) {
    warn(`evidence pilot bug register asset version ${evidence.pilotBugRegister?.evidence?.assetVersion || "missing"} does not match launch evidence asset version ${evidence.assetVersion || "missing"}; rerun the live pilot write gate after deploy`);
  }
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
  if (evidence.externalWorkflowReadiness?.schemaVersion !== "luxveritas.private_workflow_selection.v1") {
    issue("evidence external workflow readiness schemaVersion mismatch");
  }
  if (evidence.externalWorkflowReadiness?.currentPrimaryTarget !== "firebase_handoff") {
    issue("evidence external workflow readiness must keep firebase_handoff active");
  }
  if (evidence.externalWorkflowReadiness?.selectionStatus !== "recommendation_ready_approval_required") {
    issue("evidence external workflow readiness status must require approval");
  }
  if (evidence.externalWorkflowReadiness?.recommendedFirstExternalTarget !== "google_workspace") {
    issue("evidence external workflow readiness should recommend google_workspace first");
  }
  if (evidence.externalWorkflowReadiness?.selectionRule !== privateWorkflowSelection.selectionRule) {
    issue("evidence external workflow readiness selectionRule mismatch");
  }
  if (!/Firebase Secret Manager/i.test(evidence.externalWorkflowReadiness?.activationBoundary || "")) {
    issue("evidence external workflow readiness activation boundary must mention Firebase Secret Manager");
  }
  const activationOrder = Array.isArray(evidence.externalWorkflowReadiness?.recommendedActivationOrder)
    ? evidence.externalWorkflowReadiness.recommendedActivationOrder
    : [];
  for (const [index, profile] of ["google_workspace", "ghl_crm", "codex_ops"].entries()) {
    const item = activationOrder[index];
    if (!item || item.rank !== index + 1 || item.profile !== profile || item.approvalRequired !== true) {
      issue(`evidence external workflow activation rank ${index + 1} should be ${profile} with approval required`);
    }
  }
  const queueSummary = Array.isArray(evidence.externalWorkflowReadiness?.queueDecisionSummary)
    ? evidence.externalWorkflowReadiness.queueDecisionSummary
    : [];
  if (queueSummary.length !== privateWorkflowSelection.queueDecisionSummary.length) {
    issue("evidence external workflow queueDecisionSummary length mismatch");
  }
  for (const queue of ["submission_review", "press_contact", "partner_licensing", "strategic_access", "access_review"]) {
    const item = queueSummary.find((entry) => entry.queue === queue);
    if (!item || item.recommendedPrimary !== "google_workspace") {
      issue(`evidence external workflow queue ${queue} should recommend google_workspace`);
    }
  }
  if (!evidence.externalWorkflowReadiness?.nextCommandPacket?.some((item) => item.includes("activate-private-integration.mjs"))) {
    issue("evidence external workflow readiness missing activation command packet");
  }
  const blocked = Array.isArray(evidence.launchGates?.blocked) ? evidence.launchGates.blocked : [];
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
    const source = openApprovals.approvals?.find((entry) => entry.id === id);
    if (item && source && item.blocksPublicLaunch !== source.blocksPublicLaunch) {
      issue(`evidence open approval ${id} public-launch blocker mismatch`);
    }
    if (source?.blocksPublicLaunch === true && !blocked.some((gate) => gate.id === id)) {
      issue(`evidence missing current blocked gate ${id}`);
    }
    if (source?.blocksPublicLaunch === false && blocked.some((gate) => gate.id === id)) {
      issue(`evidence should not report approved gate ${id} as blocked`);
    }
  }
  for (const id of ["functions_deploy_iam", "external_workflow_target"]) {
    const item = approvalItems.find((entry) => entry.id === id);
    if (item && item.blocksPublicLaunch !== false) issue(`evidence open approval ${id} should not block public launch`);
  }
  if (evidence.approvalDecisionForms?.schemaVersion !== "luxveritas.open_approval_decision_forms.v1") {
    issue("evidence approval decision forms schemaVersion mismatch");
  }
  if (evidence.approvalDecisionForms?.counts?.totalOpenOrConditional !== approvalDecisionForms.counts?.totalOpenOrConditional) {
    issue("evidence approval decision forms open count mismatch");
  }
  if (evidence.approvalDecisionForms?.counts?.publicLaunchBlockers !== approvalDecisionForms.counts?.publicLaunchBlockers) {
    issue("evidence approval decision forms blocker count mismatch");
  }
  if (!evidence.approvalDecisionForms?.rules?.some((item) => /Do not paste secrets/i.test(item))) {
    issue("evidence approval decision forms missing no-secret rule");
  }
  if (!evidence.approvalDecisionForms?.rules?.some((item) => /private owner system/i.test(item))) {
    issue("evidence approval decision forms missing private owner system rule");
  }
  const decisionForms = Array.isArray(evidence.approvalDecisionForms?.forms) ? evidence.approvalDecisionForms.forms : [];
  if (decisionForms.length !== approvalDecisionForms.forms?.length) {
    issue("evidence approval decision forms count mismatch");
  }
  for (const id of ["privacy_review", "terms_review", "functions_deploy_iam", "external_workflow_target", "seed_binder_private_upload", "event_terms", "purchase_membership_terms"]) {
    const item = decisionForms.find((entry) => entry.id === id);
    const source = approvalDecisionForms.forms?.find((entry) => entry.id === id);
    if (!item) {
      issue(`evidence approval decision forms missing form ${id}`);
      continue;
    }
    if (!source) {
      issue(`source approval decision forms missing form ${id}`);
      continue;
    }
    if (item.templateFieldCount !== Object.keys(source.decisionRecordTemplate || {}).length) {
      issue(`evidence approval decision form ${id} template field count mismatch`);
    }
    for (const value of ["approved", "needs_changes", "blocked"]) {
      if (!item.requiredDecisionValues?.includes(value)) issue(`evidence approval decision form ${id} missing decision value ${value}`);
    }
    for (const field of ["approvalId", "reviewerName", "reviewedAt", "decision", "evidenceReference", "conditionsOrChanges"]) {
      if (!item.requiredFields?.includes(field)) issue(`evidence approval decision form ${id} missing required field ${field}`);
    }
    if (!item.versionLockKeys?.length) issue(`evidence approval decision form ${id} missing version lock keys`);
  }
  for (const id of ["privacy_review", "terms_review"]) {
    const item = decisionForms.find((entry) => entry.id === id);
    const source = approvalDecisionForms.forms?.find((entry) => entry.id === id);
    if (item && source && item.blocksPublicLaunch !== source.blocksPublicLaunch) {
      issue(`evidence approval decision form ${id} public-launch blocker mismatch`);
    }
  }
  const closeoutItems = Array.isArray(evidence.closeout?.items) ? evidence.closeout.items : [];
  if (!evidence.closeout?.updatedAt) issue("evidence closeout updatedAt missing");
  if (!evidence.closeout?.byStatus || typeof evidence.closeout.byStatus !== "object") issue("evidence closeout byStatus missing");
  for (const id of ["inbox_notifications", "privacy_review", "terms_review", "www_redirect"]) {
    if (!closeoutItems.some((item) => item.id === id)) issue(`evidence missing closeout item ${id}`);
  }
  if (!evidence.commandSummaries?.mvpStatus?.lines?.length) issue("evidence missing MVP status summary lines");
  if (evidence.commandSummaries?.previewHelper?.ok !== true) issue("evidence preview-helper summary should pass");
  if (!evidence.commandSummaries?.previewHelper?.lines?.some((line) => /Preview helper QA checked: 4 passed, 0 blocker/i.test(line))) {
    issue("evidence missing passed preview-helper QA summary line");
  }
}

if (issues.length) {
  console.error(`Launch evidence QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

if (warnings.length) {
  console.warn("Launch evidence QA warnings:");
  for (const item of warnings) console.warn(`- ${item}`);
}

console.log("Launch evidence QA passed.");
