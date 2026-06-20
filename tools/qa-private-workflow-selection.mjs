import { readFile } from "node:fs/promises";

const issues = [];

function issue(message) {
  issues.push(message);
}

function secretShape(value) {
  return /\bre_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}|REPORT_OPERATOR_TOKEN=.*[A-Za-z0-9_-]{12,}|FORM_INTEGRATION_URL=https:\/\/\S+|https?:\/\/|bearer\s+[A-Za-z0-9._-]{12,}|api[_ -]?key\s*[:=]/i.test(value);
}

const [
  selectionRaw,
  targetsRaw,
  profilesRaw,
  workflowRaw,
  deployment,
  handoff,
  runbook
] = await Promise.all([
  readFile("docs/private-workflow-selection.json", "utf8"),
  readFile("docs/external-workflow-targets.json", "utf8"),
  readFile("docs/private-integration-profiles.json", "utf8"),
  readFile("docs/private-workflow-matrix.json", "utf8"),
  readFile("docs/deployment.md", "utf8"),
  readFile("docs/production-release-handoff.md", "utf8"),
  readFile("docs/final-launch-runbook.md", "utf8")
]);

if (secretShape(selectionRaw)) {
  issue("private-workflow-selection.json appears to contain URL, account, field, token, credential, or secret-shaped data");
}

const selection = JSON.parse(selectionRaw);
const targets = JSON.parse(targetsRaw);
const profileRegistry = JSON.parse(profilesRaw);
const workflow = JSON.parse(workflowRaw);
const profiles = Array.isArray(profileRegistry.profiles) ? profileRegistry.profiles : [];
const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
const queueDecisions = Array.isArray(targets.queueDecisions) ? targets.queueDecisions : [];
const queueDecisionById = new Map(queueDecisions.map((decision) => [decision.queue, decision]));
const workflowQueues = Array.isArray(workflow.queues) ? workflow.queues : [];
const workflowQueueById = new Map(workflowQueues.map((queue) => [queue.id, queue]));
const targetCandidates = new Map((targets.candidates || []).map((candidate) => [candidate.id, candidate]));

if (selection.schemaVersion !== "luxveritas.private_workflow_selection.v1") {
  issue("private workflow selection schemaVersion mismatch");
}
if (selection.publicExposure !== "none") issue("private workflow selection publicExposure must be none");
if (selection.currentPrimaryTarget !== targets.currentPrimaryTarget || selection.currentPrimaryTarget !== workflow.currentPrimaryProfile) {
  issue("private workflow selection currentPrimaryTarget must match active target matrices");
}
if (selection.currentPrimaryTarget !== "firebase_handoff") {
  issue("private workflow selection must keep firebase_handoff active until external approval");
}
if (selection.selectionStatus !== "recommendation_ready_approval_required") {
  issue("private workflow selection status must stay approval-required before real provider setup");
}
if (selection.recommendedFirstExternalTarget !== "google_workspace") {
  issue("private workflow selection should recommend google_workspace as the first external approval target");
}
if (!/Firebase Secret Manager/i.test(selection.activationBoundary || "")) {
  issue("private workflow selection activationBoundary must require Firebase Secret Manager");
}
if (!/Keep firebase_handoff active/i.test(selection.selectionRule || "")) {
  issue("private workflow selection must keep firebase_handoff active until approval");
}

const order = Array.isArray(selection.recommendedActivationOrder) ? selection.recommendedActivationOrder : [];
if (order.length !== 3) issue("private workflow selection must include three external activation recommendations");
const orderProfiles = order.map((item) => item.profile);
for (const [expectedIndex, expectedProfile] of ["google_workspace", "ghl_crm", "codex_ops"].entries()) {
  if (orderProfiles[expectedIndex] !== expectedProfile) {
    issue(`private workflow selection activation rank ${expectedIndex + 1} should be ${expectedProfile}`);
  }
}

for (const item of order) {
  const profile = profileById.get(item.profile);
  const candidate = targetCandidates.get(item.profile);
  if (!profile) {
    issue(`private workflow selection references unknown profile ${item.profile || "missing"}`);
    continue;
  }
  if (profile.status !== "future") issue(`${item.profile}: external recommendation should remain future before approval`);
  if (!candidate) issue(`${item.profile}: missing external workflow candidate`);
  if (candidate && candidate.decisionStatus !== "approval_required") issue(`${item.profile}: candidate must remain approval_required`);
  if (item.approvalRequired !== true) issue(`${item.profile}: recommendation must require approval`);
  if (!Array.isArray(item.queueCoverage) || !item.queueCoverage.length) issue(`${item.profile}: queueCoverage missing`);
  if (!Array.isArray(item.acceptance) || item.acceptance.length < 3) issue(`${item.profile}: acceptance checks missing`);
  for (const queueId of item.queueCoverage || []) {
    const queue = workflowQueueById.get(queueId);
    if (!queue) {
      issue(`${item.profile}: queueCoverage references unknown queue ${queueId}`);
    } else if (!queue.approvedNextProfiles?.includes(item.profile)) {
      issue(`${item.profile}: queue ${queueId} does not approve this profile`);
    }
  }
}

const summary = Array.isArray(selection.queueDecisionSummary) ? selection.queueDecisionSummary : [];
if (summary.length !== workflowQueues.length) {
  issue(`private workflow selection queueDecisionSummary should include ${workflowQueues.length} queue(s)`);
}
for (const queue of workflowQueues) {
  const summaryItem = summary.find((item) => item.queue === queue.id);
  const targetDecision = queueDecisionById.get(queue.id);
  if (!summaryItem) {
    issue(`private workflow selection missing queue summary ${queue.id}`);
    continue;
  }
  if (!targetDecision) {
    issue(`external workflow targets missing queue decision ${queue.id}`);
    continue;
  }
  if (summaryItem.recommendedPrimary !== targetDecision.recommendedPrimary) {
    issue(`${queue.id}: selection recommendedPrimary must match external target decision`);
  }
  if (!summaryItem.selectionUse || summaryItem.selectionUse.length < 15) {
    issue(`${queue.id}: selectionUse must explain the recommendation`);
  }
}

const googlePrimaryCount = queueDecisions.filter((decision) => decision.recommendedPrimary === "google_workspace").length;
const ghlPrimaryCount = queueDecisions.filter((decision) => decision.recommendedPrimary === "ghl_crm").length;
if (googlePrimaryCount < 5) issue("google_workspace should be primary for at least five queue decisions");
if (ghlPrimaryCount < 2) issue("ghl_crm should be primary for membership and event follow-up queues");

for (const step of [
  "Confirm Privacy and Terms legal review status before public launch.",
  "Choose one target profile and one workflow owner.",
  "Approve receiver location and signing material outside this repo.",
  "Export the no-secret private integration request.",
  "Run private workflow selection QA.",
  "Run activation dry run for the selected target.",
  "Set Firebase secrets only after approval.",
  "Run live operator report QA."
]) {
  if (!selection.approvalChecklist?.includes(step)) issue(`approvalChecklist missing step: ${step}`);
}

for (const guard of [
  "Do not replace firebase_handoff without an approved receiver and rollback owner.",
  "Do not store provider URLs, account IDs, field IDs, private destinations, tokens, or credentials in this repo.",
  "Do not choose a CRM target before consent language and follow-up rules are approved.",
  "Do not activate CodexOps before operator packet fields and human review rules are approved."
]) {
  if (!selection.doNotDo?.includes(guard)) issue(`doNotDo missing guard: ${guard}`);
}

for (const command of [
  "node tools/qa-private-workflow-selection.mjs",
  "LUX_PRIVATE_INTEGRATION_PACKET_OUT=/tmp/lux-private-integration-request.md node tools/export-private-integration-request.mjs",
  "LUX_FORM_INTEGRATION_TARGET='google_workspace' node tools/activate-private-integration.mjs",
  "node tools/qa-provider-readiness.mjs",
  "node tools/qa-live-operator-report.mjs"
]) {
  if (!selection.nextCommandPacket?.some((item) => item.includes(command))) {
    issue(`nextCommandPacket missing command marker: ${command}`);
  }
}

for (const step of [
  "Return FORM_INTEGRATION_TARGET to firebase_handoff.",
  "Run provider readiness and live operator report QA."
]) {
  if (!selection.rollback?.includes(step)) issue(`rollback missing step: ${step}`);
}

for (const [label, doc] of [
  ["deployment", deployment],
  ["production release handoff", handoff],
  ["final launch runbook", runbook]
]) {
  for (const marker of [
    "docs/private-workflow-selection.json",
    "node tools/qa-private-workflow-selection.mjs",
    "google_workspace"
  ]) {
    if (!doc.includes(marker)) issue(`${label} missing private workflow selection marker: ${marker}`);
  }
}

if (issues.length) {
  console.error(`Private workflow selection QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log("Private workflow selection QA passed.");
