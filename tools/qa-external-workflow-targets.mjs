import { readFile } from "node:fs/promises";

const issues = [];

function issue(message) {
  issues.push(message);
}

function secretShape(value) {
  return /re_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}|REPORT_OPERATOR_TOKEN=.*[A-Za-z0-9_-]{12,}|FORM_INTEGRATION_URL=https:\/\/\S+|https?:\/\/|account[_ -]?id|field[_ -]?id|bearer|password|api[_ -]?key/i.test(value);
}

const [targetsRaw, profilesRaw, workflowRaw, fieldMapRaw, deploymentRaw] = await Promise.all([
  readFile("docs/external-workflow-targets.json", "utf8"),
  readFile("docs/private-integration-profiles.json", "utf8"),
  readFile("docs/private-workflow-matrix.json", "utf8"),
  readFile("docs/private-integration-field-map.json", "utf8"),
  readFile("docs/deployment.md", "utf8")
]);

if (secretShape(targetsRaw)) {
  issue("external-workflow-targets.json appears to contain URL, account, field, or credential-shaped data");
}

const targets = JSON.parse(targetsRaw);
const profileRegistry = JSON.parse(profilesRaw);
const workflow = JSON.parse(workflowRaw);
const fieldMap = JSON.parse(fieldMapRaw);

const profiles = Array.isArray(profileRegistry.profiles) ? profileRegistry.profiles : [];
const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
const mappedProfileIds = new Set((fieldMap.profiles || []).map((profile) => profile.id));
const queues = Array.isArray(workflow.queues) ? workflow.queues : [];
const queueById = new Map(queues.map((queue) => [queue.id, queue]));
const candidates = Array.isArray(targets.candidates) ? targets.candidates : [];
const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
const queueDecisions = Array.isArray(targets.queueDecisions) ? targets.queueDecisions : [];
const allowedDecisionStatuses = new Set(["active_mvp", "ready_label", "approval_required"]);
const futureIds = new Set(profiles.filter((profile) => profile.status === "future").map((profile) => profile.id));

if (targets.schemaVersion !== "luxveritas.external_workflow_targets.v1") {
  issue("external workflow target schemaVersion mismatch");
}
if (targets.currentPrimaryTarget !== workflow.currentPrimaryProfile) {
  issue("currentPrimaryTarget must match private workflow currentPrimaryProfile");
}
if (targets.currentPrimaryTarget !== "firebase_handoff") {
  issue("currentPrimaryTarget must remain firebase_handoff until an external target is approved");
}
if (targets.publicExposure !== "none") {
  issue("external workflow target publicExposure must be none");
}
if (!/must not contain provider URLs/i.test(targets.purpose || "")) {
  issue("external workflow target purpose must state no provider URL rule");
}
if (!/Firebase Secret Manager/i.test(targets.activationBoundary || "")) {
  issue("activationBoundary must require Firebase Secret Manager");
}
if (!/brand familiarity/i.test(targets.operatorPrinciple || "")) {
  issue("operatorPrinciple must discourage provider-choice by familiarity alone");
}
if (!/intentionally not runnable/i.test(targets.commandTemplateNote || "")) {
  issue("commandTemplateNote must state placeholder commands are not directly runnable");
}

for (const profile of profiles) {
  const candidate = candidateById.get(profile.id);
  if (!candidate) {
    issue(`external workflow targets missing candidate ${profile.id}`);
    continue;
  }
  if (candidate.activationTarget !== profile.targetSecretValue) {
    issue(`${profile.id}: activationTarget must match targetSecretValue`);
  }
  if (!allowedDecisionStatuses.has(candidate.decisionStatus)) {
    issue(`${profile.id}: invalid decisionStatus ${candidate.decisionStatus || "missing"}`);
  }
  if (!mappedProfileIds.has(candidate.id)) {
    issue(`${profile.id}: missing downstream field map`);
  }
  for (const field of ["bestFor", "notFor", "prerequisites", "approvalGuards", "acceptance", "commands"]) {
    if (!Array.isArray(candidate[field]) || candidate[field].length < 1) {
      issue(`${profile.id}: missing ${field}`);
    }
  }
  if (futureIds.has(profile.id)) {
    const guardText = `${candidate.approvalGuards?.join(" ")} ${candidate.commands?.join(" ")}`;
    if (candidate.decisionStatus !== "approval_required") {
      issue(`${profile.id}: future profile must be approval_required`);
    }
    if (!guardText.includes("LUX_PRIVATE_INTEGRATION_ALLOW_FUTURE=1")) {
      issue(`${profile.id}: future profile must require LUX_PRIVATE_INTEGRATION_ALLOW_FUTURE=1`);
    }
    if (!/explicit human approval/i.test(guardText)) {
      issue(`${profile.id}: future profile must require explicit human approval`);
    }
  }
  if (!candidate.commands?.some((command) => command.includes("tools/activate-private-integration.mjs") || command.includes("tools/qa-provider-readiness.mjs"))) {
    issue(`${profile.id}: commands must include activation or provider readiness`);
  }
}

if (queueDecisions.length !== queues.length) {
  issue(`expected ${queues.length} queue decisions, found ${queueDecisions.length}`);
}

for (const queue of queues) {
  const decision = queueDecisions.find((item) => item.queue === queue.id);
  if (!decision) {
    issue(`missing queue decision for ${queue.id}`);
    continue;
  }
  const allowedNext = new Set(queue.approvedNextProfiles || []);
  if (!allowedNext.has(decision.recommendedPrimary)) {
    issue(`${queue.id}: recommendedPrimary ${decision.recommendedPrimary} is not approved in private workflow matrix`);
  }
  if (!candidateById.has(decision.recommendedPrimary)) {
    issue(`${queue.id}: recommendedPrimary ${decision.recommendedPrimary} has no candidate`);
  }
  if (!decision.reason || decision.reason.length < 20) {
    issue(`${queue.id}: queue decision needs a meaningful reason`);
  }
  for (const alternative of decision.alternatives || []) {
    if (!allowedNext.has(alternative)) {
      issue(`${queue.id}: alternative ${alternative} is not approved in private workflow matrix`);
    }
    if (!candidateById.has(alternative)) {
      issue(`${queue.id}: alternative ${alternative} has no candidate`);
    }
  }
}

for (const step of [
  "Confirm Privacy and Terms legal review status.",
  "Export the private integration activation request.",
  "Run activation dry run for the selected target.",
  "Set Firebase secrets only after approval.",
  "Run live operator report QA."
]) {
  if (!targets.approvalSequence?.includes(step)) issue(`approvalSequence missing step: ${step}`);
}

for (const step of [
  "Return FORM_INTEGRATION_TARGET to firebase_handoff.",
  "Run provider readiness and live operator report QA."
]) {
  if (!targets.rollback?.includes(step)) issue(`rollback missing step: ${step}`);
}

for (const marker of [
  "docs/external-workflow-targets.json",
  "node tools/qa-external-workflow-targets.mjs"
]) {
  if (!deploymentRaw.includes(marker)) issue(`docs/deployment.md missing marker: ${marker}`);
}

if (issues.length) {
  console.error(`External workflow target QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`External workflow target QA passed for ${candidates.length} candidate target(s) and ${queueDecisions.length} queue decision(s).`);
