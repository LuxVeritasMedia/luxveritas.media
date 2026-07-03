import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const issues = [];

function issue(message) {
  issues.push(message);
}

function includesText(list, pattern) {
  return Array.isArray(list) && list.some((item) => pattern.test(String(item)));
}

function secretShape(value) {
  return /\bre_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}|REPORT_OPERATOR_TOKEN=.*[A-Za-z0-9_-]{12,}|FORM_INTEGRATION_URL=https:\/\/\S+/i.test(value);
}

const [markdownResult, jsonResult, profilesRaw, fieldMapRaw, workflowMatrixRaw, workflowSelectionRaw, pilotEvidenceRaw, publicTermsRaw] = await Promise.all([
  execFileAsync(process.execPath, ["tools/export-private-integration-request.mjs"], {
    timeout: 30000,
    maxBuffer: 1024 * 1024 * 4
  }),
  execFileAsync(process.execPath, ["tools/export-private-integration-request.mjs"], {
    env: { ...process.env, LUX_PRIVATE_INTEGRATION_PACKET_FORMAT: "json" },
    timeout: 30000,
    maxBuffer: 1024 * 1024 * 4
  }),
  readFile("docs/private-integration-profiles.json", "utf8"),
  readFile("docs/private-integration-field-map.json", "utf8"),
  readFile("docs/private-workflow-matrix.json", "utf8"),
  readFile("docs/private-workflow-selection.json", "utf8"),
  readFile("data/lux-pilot-write-evidence.json", "utf8"),
  readFile("data/lux-public-terms.json", "utf8")
]);

const markdown = markdownResult.stdout;
const jsonRaw = jsonResult.stdout;
const registry = JSON.parse(profilesRaw);
const fieldMap = JSON.parse(fieldMapRaw);
const workflowMatrix = JSON.parse(workflowMatrixRaw);
const workflowSelection = JSON.parse(workflowSelectionRaw);
const pilotEvidence = JSON.parse(pilotEvidenceRaw);
const publicTerms = JSON.parse(publicTermsRaw);
const profiles = Array.isArray(registry.profiles) ? registry.profiles : [];

if (secretShape(markdown) || secretShape(jsonRaw)) {
  issue("private integration request appears to contain secret-shaped data");
}

for (const marker of [
  "# Lux Veritas Private Integration Activation Request",
  "No-secret private handoff activation request",
  "Current Handoff Gate",
  "Current Pilot Evidence",
  "Live capture intents: 11",
  "Live event writes: 13",
  "Downstream Field Map",
  "Downstream Workflow Matrix",
  "Private Workflow Selection",
  "Receiver Implementation Sample",
  "Sample headers:",
  "Sample payload:",
  "sample-shared-secret-not-production",
  "integration-review@example.com",
  "membership_waitlist",
  "Recommended first external target: google_workspace",
  "Exact First External Approval",
  "identified_pending_explicit_private_workflow_owner_approval",
  "I approve google_workspace as the first external private workflow target",
  "Approve google_workspace as the first external target only",
  "Private values required outside this repo",
  "Approval Decision Intake",
  "Required decision values:",
  "Required fields:",
  "Version lock:",
  "Pilot QA run ID:",
  "Public terms version:",
  "Do not approve if:",
  "No-secret evidence examples:",
  "receiverLocationEvidence",
  "signingMaterialEvidence",
  "legalVersionEvidenceOwner",
  "Recommended First External Activation",
  "Target: google_workspace",
  "Label: Google Workspace Intake",
  "Provider class: workspace_automation",
  "Target secret value: google_workspace",
  "Required approval fields",
  "Dry run:",
  "Activation after approval:",
  "Post-activation checks:",
  "Target acceptance:",
  "Rollback:",
  "LUX_FORM_INTEGRATION_TARGET='google_workspace'",
  "LUX_PILOT_WRITE_TESTS=1",
  "Required Firebase Secrets",
  "Active Or Ready Profiles",
  "Future Profiles",
  "Activation Commands",
  "LUX_PRIVATE_INTEGRATION_ACTIVATION_DRY_RUN=1",
  "LUX_PRIVATE_INTEGRATION_ALLOW_FUTURE=1",
  "node tools/activate-private-integration.mjs",
  "node tools/qa-provider-readiness.mjs",
  "node tools/qa-integrations.mjs",
  "node tools/qa-integration-contract.mjs",
  "node tools/qa-release-readiness.mjs"
]) {
  if (!markdown.includes(marker)) issue(`markdown request missing marker: ${marker}`);
}

let packet = null;
try {
  packet = JSON.parse(jsonRaw);
} catch (error) {
  issue(`private integration request JSON is invalid: ${error?.message || String(error)}`);
}

if (packet) {
  if (packet.schemaVersion !== "luxveritas.private_integration_request.v1") {
    issue("private integration request schemaVersion mismatch");
  }
  if (packet.project !== "LuxVeritas.media") issue("private integration request project mismatch");
  if (packet.liveUrl !== "https://luxveritas.media") issue("private integration request liveUrl mismatch");
  if (!packet.assetVersion) issue("private integration request assetVersion missing");
  if (packet.registry?.schemaVersion !== registry.schemaVersion) issue("profile registry schema mismatch");
  if (packet.pilotEvidence?.source !== "data/lux-pilot-write-evidence.json") issue("pilot evidence source mismatch");
  if (packet.pilotEvidence?.qaRunId !== pilotEvidence.qaRunId) issue("pilot evidence QA run mismatch");
  if (packet.pilotEvidence?.assetVersion !== pilotEvidence.assetVersion) issue("pilot evidence asset version mismatch");
  if (packet.pilotEvidence?.formCaptureIntents !== pilotEvidence.writeEvidence?.formCaptureIntents) issue("pilot evidence form count mismatch");
  if (packet.pilotEvidence?.eventWrites !== pilotEvidence.writeEvidence?.eventWrites) issue("pilot evidence event count mismatch");
  if (packet.pilotEvidence?.inboxDeliveryRequired !== true) issue("pilot evidence inbox flag missing");
  if (packet.pilotEvidence?.operatorReportVerified !== true) issue("pilot evidence operator report flag missing");
  if (packet.pilotEvidence?.postWriteReconciliation !== true) issue("pilot evidence reconciliation flag missing");
  if (packet.fieldMap?.schemaVersion !== fieldMap.schemaVersion) issue("field map schema mismatch");
  if (packet.fieldMap?.contract !== "luxveritas.form_submission.v1") issue("field map contract mismatch");
  if (packet.fieldMap?.eventType !== "form.submission.received") issue("field map event mismatch");
  for (const path of ["receiptId", "contact.email", "routing.queue", "legal.termsVersion"]) {
    if (!packet.fieldMap?.requiredPayloadPaths?.includes(path)) issue(`field map missing required path ${path}`);
  }
  if (packet.contract?.schemaVersion !== "luxveritas.form_submission.v1") issue("contract schema mismatch");
  if (packet.contract?.eventType !== "form.submission.received") issue("contract event mismatch");
  if (packet.workflowMatrix?.schemaVersion !== workflowMatrix.schemaVersion) issue("workflow matrix schema mismatch");
  if (packet.workflowMatrix?.contract !== "luxveritas.form_submission.v1") issue("workflow matrix contract mismatch");
  if (packet.workflowMatrix?.eventType !== "form.submission.received") issue("workflow matrix event mismatch");
  if (packet.workflowMatrix?.currentPrimaryProfile !== "firebase_handoff") issue("workflow matrix primary profile mismatch");
  if (packet.workflowMatrix?.publicExposure !== "none") issue("workflow matrix public exposure mismatch");
  if (packet.workflowMatrix?.queueCount !== 7) issue("workflow matrix queue count mismatch");
  if (packet.workflowSelection?.schemaVersion !== "luxveritas.private_workflow_selection.v1") issue("workflow selection schema mismatch");
  if (packet.workflowSelection?.selectionStatus !== "recommendation_ready_approval_required") issue("workflow selection status mismatch");
  if (packet.workflowSelection?.currentPrimaryTarget !== "firebase_handoff") issue("workflow selection current primary target mismatch");
  if (packet.workflowSelection?.recommendedFirstExternalTarget !== "google_workspace") issue("workflow selection first target mismatch");
  if (!packet.workflowSelection?.recommendationRationale?.includes("Google Workspace Intake")) issue("workflow selection rationale missing");
  const firstExternalApproval = packet.workflowSelection?.recommendedFirstExternalApproval;
  if (!firstExternalApproval) {
    issue("workflow selection missing first external approval block");
  } else {
    if (firstExternalApproval.status !== "identified_pending_explicit_private_workflow_owner_approval") {
      issue("workflow selection first external approval status mismatch");
    }
    if (firstExternalApproval.target !== "google_workspace" || firstExternalApproval.targetSecretValue !== "google_workspace") {
      issue("workflow selection first external approval target mismatch");
    }
    if (!/I approve google_workspace as the first external private workflow target/i.test(firstExternalApproval.approvalLanguage || "")) {
      issue("workflow selection first external approval language missing");
    }
    for (const scope of [
      "Approve google_workspace as the first external target only; do not activate ghl_crm or codex_ops from this approval.",
      "Approve server-side handoff only through Firebase Secret Manager."
    ]) {
      if (!firstExternalApproval.approvalScope?.includes(scope)) issue(`workflow selection first external approval missing scope ${scope}`);
    }
    for (const privateValue of ["workflow owner", "receiver owner", "replay owner", "rollback owner", "legal-version evidence owner"]) {
      if (!firstExternalApproval.privateValuesRequiredOutsideRepo?.includes(privateValue)) {
        issue(`workflow selection first external approval missing private value ${privateValue}`);
      }
    }
    for (const evidence of [
      "Private workflow owner accepts queue routing and retention expectations.",
      "Activation dry run passes with LUX_PRIVATE_INTEGRATION_ALLOW_FUTURE=1.",
      "Provider readiness reports google_workspace active without printing destination values."
    ]) {
      const evidenceBuckets = [
        firstExternalApproval.approvalEvidence,
        firstExternalApproval.dryRunEvidence,
        firstExternalApproval.postActivationEvidence
      ].filter(Array.isArray);
      if (!evidenceBuckets.some((bucket) => bucket.includes(evidence))) {
        issue(`workflow selection first external approval missing evidence ${evidence}`);
      }
    }
  }
  if (!Array.isArray(packet.workflowSelection?.recommendedActivationOrder) || packet.workflowSelection.recommendedActivationOrder.length !== 3) {
    issue("workflow selection activation order missing");
  } else {
    for (const [index, expected] of ["google_workspace", "ghl_crm", "codex_ops"].entries()) {
      const item = packet.workflowSelection.recommendedActivationOrder[index];
      if (item?.profile !== expected || item.rank !== index + 1 || item.approvalRequired !== true) {
        issue(`workflow selection rank ${index + 1} should be ${expected} with approval required`);
      }
    }
  }
  for (const guard of ["Set Firebase secrets only after approval.", "Run live operator report QA."]) {
    if (!packet.workflowSelection?.approvalChecklist?.includes(guard)) issue(`workflow selection approval checklist missing ${guard}`);
  }
  if (!packet.workflowSelection?.approvalDecisionIntake) {
    issue("workflow selection missing approval decision intake summary");
  }
  const decisionIntake = packet.approvalDecisionIntake;
  if (!decisionIntake) {
    issue("private integration request missing approvalDecisionIntake");
  } else {
    if (decisionIntake.purpose !== workflowSelection.approvalDecisionIntake?.purpose) {
      issue("approval decision intake purpose mismatch");
    }
    if (!/outside the public repo/i.test(decisionIntake.purpose || "")) {
      issue("approval decision intake purpose must require records outside public repo");
    }
    for (const value of ["approved", "needs_changes", "blocked"]) {
      if (!decisionIntake.requiredDecisionValues?.includes(value)) {
        issue(`approval decision intake missing decision value ${value}`);
      }
    }
    for (const field of [
      "reviewerName",
      "reviewedAt",
      "decision",
      "target",
      "workflowOwner",
      "receiverOwner",
      "receiverLocationEvidence",
      "signingMaterialEvidence",
      "replayOwner",
      "rollbackOwner",
      "retentionExpectation",
      "legalVersionEvidenceOwner",
      "evidenceReference",
      "conditionsOrChanges"
    ]) {
      if (!decisionIntake.requiredFields?.includes(field)) {
        issue(`approval decision intake missing required field ${field}`);
      }
    }
    const versionLock = decisionIntake.versionLock || {};
    if (versionLock.selectionSchemaVersion !== workflowSelection.schemaVersion) issue("approval decision intake selection version mismatch");
    if (versionLock.recommendedTarget !== "google_workspace") issue("approval decision intake recommended target mismatch");
    if (versionLock.currentPrimaryTarget !== "firebase_handoff") issue("approval decision intake current primary target mismatch");
    if (versionLock.assetVersion !== pilotEvidence.assetVersion) issue("approval decision intake asset version mismatch");
    if (versionLock.pilotQaRunId !== pilotEvidence.qaRunId) issue("approval decision intake pilot QA run mismatch");
    if (versionLock.publicTermsVersion !== publicTerms.version) issue("approval decision intake public terms version mismatch");
    if (versionLock.privacyVersion !== publicTerms.privacyVersion) issue("approval decision intake privacy version mismatch");
    if (versionLock.termsVersion !== publicTerms.termsVersion) issue("approval decision intake terms version mismatch");
    if (versionLock.submissionTermsVersion !== publicTerms.submissionTermsVersion) issue("approval decision intake submission terms version mismatch");
    const blockerChecks = [
      [/receiver location.*signing material.*target identity.*public repo/i, "receiver/signing/target public repo blocker"],
      [/activate ghl_crm or codex_ops.*google_workspace approval scope/i, "target scope blocker"],
      [/public routes.*provider account data.*provider field IDs.*URLs.*tokens.*prompts.*internal dashboards.*financials.*rights.*unreleased canon/i, "public exposure blocker"]
    ];
    for (const [pattern, label] of blockerChecks) {
      if (!includesText(decisionIntake.blockApprovalIf, pattern)) {
        issue(`approval decision intake missing ${label}`);
      }
    }
    const evidenceChecks = [
      [/private workflow approval note/i, "private workflow approval note example"],
      [/receiver readiness checklist ID.*without endpoint.*token.*field ID/i, "receiver checklist no-secret example"],
      [/retention approval note/i, "retention approval note example"]
    ];
    for (const [pattern, label] of evidenceChecks) {
      if (!includesText(decisionIntake.noSecretEvidenceExamples, pattern)) {
        issue(`approval decision intake missing ${label}`);
      }
    }
  }
  if (!packet.recommendedExternalActivation) {
    issue("private integration request missing recommendedExternalActivation");
  } else {
    const activation = packet.recommendedExternalActivation;
    if (activation.target !== "google_workspace") issue("recommended external target should be google_workspace");
    if (activation.label !== "Google Workspace Intake") issue("recommended external label should be Google Workspace Intake");
    if (activation.providerClass !== "workspace_automation") issue("recommended external provider class mismatch");
    if (activation.targetSecretValue !== "google_workspace") issue("recommended external target secret value mismatch");
    if (!/I approve google_workspace as the first external private workflow target/i.test(activation.approvalLanguage || "")) {
      issue("recommended external activation missing exact approval language");
    }
    if (!activation.approvalScope?.includes("Approve google_workspace as the first external target only; do not activate ghl_crm or codex_ops from this approval.")) {
      issue("recommended external activation missing exact approval scope");
    }
    if (activation.approvalRequired !== true) issue("recommended external activation must require approval");
    for (const queue of ["submission_review", "press_contact", "partner_licensing", "strategic_access", "access_review"]) {
      if (!activation.queueCoverage?.includes(queue)) issue(`recommended external activation missing queue ${queue}`);
    }
    for (const field of ["workflow owner", "receiver owner", "replay owner", "rollback owner", "legal-version evidence owner"]) {
      if (!activation.requiredApprovalFields?.includes(field)) issue(`recommended external activation missing approval field ${field}`);
    }
    for (const marker of [
      "LUX_PRIVATE_INTEGRATION_ALLOW_FUTURE=1",
      "LUX_PRIVATE_INTEGRATION_ACTIVATION_DRY_RUN=1",
      "LUX_FORM_INTEGRATION_TARGET='google_workspace'",
      "node tools/activate-private-integration.mjs"
    ]) {
      if (!activation.dryRunCommand?.includes(marker)) issue(`recommended dry-run command missing ${marker}`);
    }
    if (!activation.activationCommand?.includes("LUX_FORM_INTEGRATION_TARGET='google_workspace'")) {
      issue("recommended activation command missing google_workspace target");
    }
    for (const check of [
      "node tools/qa-provider-readiness.mjs",
      "node tools/qa-live-operator-report.mjs",
      "LUX_FORM_MATRIX_WRITE=1 LUX_EXPECT_EMAIL_SENT=1 node tools/qa-live-form-matrix.mjs",
      "LUX_PILOT_WRITE_TESTS=1 node tools/qa-pilot-write-gate.mjs"
    ]) {
      if (!activation.postActivationChecks?.includes(check)) issue(`recommended external activation missing check ${check}`);
    }
    for (const acceptance of [
      "Firebase handoff remains the rollback path until the external receiver proves live writes and replay.",
      "No public route exposes the receiver URL, provider account data, field IDs, tokens, or workflow implementation details."
    ]) {
      if (!activation.acceptance?.includes(acceptance)) issue(`recommended external activation missing acceptance ${acceptance}`);
    }
    if (!activation.rollback?.includes("Return FORM_INTEGRATION_TARGET to firebase_handoff.")) {
      issue("recommended external activation missing firebase_handoff rollback");
    }
  }
  for (const queueId of ["membership_waitlist", "submission_review", "event_access", "press_contact", "partner_licensing", "strategic_access", "access_review"]) {
    const queue = packet.workflowMatrix?.queues?.find((item) => item.id === queueId);
    if (!queue) {
      issue(`workflow matrix missing queue ${queueId}`);
      continue;
    }
    if (!queue.owner || !queue.sla || !queue.currentProfile) issue(`${queueId}: workflow matrix summary missing owner, sla, or currentProfile`);
    if (!queue.approvedNextProfiles?.length) issue(`${queueId}: workflow matrix summary missing approvedNextProfiles`);
    if (!queue.actions?.length) issue(`${queueId}: workflow matrix summary missing actions`);
    if (!queue.acceptance?.length) issue(`${queueId}: workflow matrix summary missing acceptance checks`);
  }
  for (const header of ["X-Lux-Event", "X-Lux-Idempotency-Key", "X-Lux-Target", "X-Lux-Signature"]) {
    if (!packet.contract?.headers?.includes(header)) issue(`contract missing header ${header}`);
  }
  if (packet.receiverImplementation?.method !== "POST") issue("receiver implementation method mismatch");
  if (packet.receiverImplementation?.contentType !== "application/json") issue("receiver implementation content type mismatch");
  if (packet.receiverImplementation?.timeoutMs !== 6000) issue("receiver implementation timeout mismatch");
  if (!packet.receiverImplementation?.expectedSuccess?.includes("2xx")) issue("receiver implementation missing 2xx success rule");
  if (!packet.receiverImplementation?.expectedFailure?.includes("replayable")) issue("receiver implementation missing replayable failure rule");
  if (!packet.receiverImplementation?.idempotency?.includes("X-Lux-Idempotency-Key")) issue("receiver implementation missing idempotency guidance");
  if (!packet.receiverImplementation?.signature?.includes("HMAC-SHA256")) issue("receiver implementation missing signature guidance");
  if (packet.receiverImplementation?.sampleSigningSecret !== "sample-shared-secret-not-production") issue("receiver implementation sample secret mismatch");
  if (packet.receiverImplementation?.sampleHeaders?.["X-Lux-Target"] !== "google_workspace") issue("receiver sample headers target mismatch");
  if (!/^[a-f0-9]{64}$/.test(packet.receiverImplementation?.sampleHeaders?.["X-Lux-Signature"] || "")) issue("receiver sample signature shape mismatch");
  if (packet.receiverImplementation?.samplePayload?.schemaVersion !== "luxveritas.form_submission.v1") issue("receiver sample payload schema mismatch");
  if (packet.receiverImplementation?.samplePayload?.eventType !== "form.submission.received") issue("receiver sample payload event mismatch");
  if (packet.receiverImplementation?.samplePayload?.integrationTarget !== "google_workspace") issue("receiver sample payload target mismatch");
  if (packet.receiverImplementation?.samplePayload?.routing?.queue !== "membership_waitlist") issue("receiver sample payload routing mismatch");
  if (packet.receiverImplementation?.samplePayload?.contact?.email !== "integration-review@example.com") issue("receiver sample payload email mismatch");
  for (const secret of ["FORM_INTEGRATION_URL", "FORM_INTEGRATION_SIGNING_SECRET", "FORM_INTEGRATION_TARGET"]) {
    if (!packet.requiredSecrets?.includes(secret)) issue(`private integration request missing secret ${secret}`);
  }
  for (const profile of profiles) {
    const bucket = profile.status === "future" ? packet.futureProfiles : packet.approvedProfiles;
    const requestProfile = bucket?.find((item) => item.id === profile.id);
    if (!requestProfile) {
      issue(`private integration request missing profile ${profile.id}`);
      continue;
    }
    if (requestProfile.targetSecretValue !== profile.targetSecretValue) {
      issue(`${profile.id}: targetSecretValue mismatch`);
    }
    const mapping = packet.fieldMap?.profileMappings?.find((item) => item.id === profile.id);
    if (!mapping) issue(`private integration request missing field map profile ${profile.id}`);
    else {
      if (!mapping.destinationType || !mapping.primaryRecord) issue(`${profile.id}: field map summary missing destination metadata`);
      if (!mapping.fieldBuckets || !Object.keys(mapping.fieldBuckets).length) issue(`${profile.id}: field map summary missing field buckets`);
    }
  }
  for (const id of ["ghl_crm", "google_workspace", "codex_ops"]) {
    const futureProfile = packet.futureProfiles?.find((profile) => profile.id === id);
    if (!futureProfile?.approvalRequired?.includes("LUX_PRIVATE_INTEGRATION_ALLOW_FUTURE=1")) {
      issue(`future profile ${id} missing approval guard`);
    }
  }
  for (const command of [
    "node tools/activate-private-integration.mjs",
    "node tools/qa-provider-readiness.mjs",
    "node tools/qa-release-readiness.mjs"
  ]) {
    if (!packet.activationCommands?.some((item) => item.includes(command))) {
      issue(`private integration request missing activation command ${command}`);
    }
  }
}

if (/hooks\.|webhookUrl|bearer|password|api[_ -]?key/i.test(`${markdown}\n${jsonRaw}`.replace(/No-secret/g, ""))) {
  issue("private integration request appears to contain provider credential language");
}

if (issues.length) {
  console.error(`Private integration request QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log("Private integration request QA passed.");
