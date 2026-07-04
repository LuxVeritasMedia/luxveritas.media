import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const node = process.execPath;
const issues = [];
const mutableFiles = [
  "docs/private-workflow-selection.json",
  "docs/private-integration-profiles.json",
  "docs/private-integration-field-map.json",
  "docs/private-workflow-matrix.json",
  "data/lux-pilot-write-evidence.json",
  "data/lux-public-terms.json"
];
const placeholderUrl = "https://approved-google-workspace-receiver.example/intake";
const placeholderSecret = "approved-shared-secret-for-dry-run-only";
const secretPattern = /\bre_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}|REPORT_OPERATOR_TOKEN=.*[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{16,}|FORM_INTEGRATION_URL=https:\/\/\S+/i;

function issue(message) {
  issues.push(message);
}

async function snapshot() {
  return Object.fromEntries(await Promise.all(mutableFiles.map(async (file) => [file, await readFile(file, "utf8")])));
}

function assertSnapshotUnchanged(before, after, label) {
  for (const file of mutableFiles) {
    if (before[file] !== after[file]) issue(`${label}: dry-run changed ${file}`);
  }
}

function cleanSecretScanText(value) {
  return String(value)
    .replaceAll(placeholderUrl, "APPROVED_PLACEHOLDER_RECEIVER")
    .replaceAll(placeholderSecret, "APPROVED_PLACEHOLDER_SECRET")
    .replace(/sample-shared-secret-not-production/g, "SAMPLE_SECRET")
    .replace(/https:\/\/luxveritas\.media/g, "LIVE_URL")
    .replace(/https:\/\/approved-[a-z-]+\.example\/intake/g, "APPROVED_PLACEHOLDER_RECEIVER")
    .replace(/https:\/\/approved-private-receiver\.example\/intake/g, "APPROVED_PLACEHOLDER_RECEIVER");
}

function assertNoSecretShape(label, value) {
  if (secretPattern.test(cleanSecretScanText(value))) {
    issue(`${label}: contains secret-shaped data`);
  }
}

function includesAll(values, required, label) {
  for (const value of required) {
    if (!values.includes(value)) issue(`${label}: missing ${value}`);
  }
}

async function runActivation(label, env, expectOk, expectedText) {
  const before = await snapshot();
  try {
    const { stdout, stderr } = await execFileAsync(node, ["tools/activate-private-integration.mjs"], {
      env: {
        ...process.env,
        LUX_PRIVATE_INTEGRATION_ACTIVATION_DRY_RUN: "1",
        LUX_FORM_INTEGRATION_URL: placeholderUrl,
        LUX_FORM_INTEGRATION_SIGNING_SECRET: placeholderSecret,
        LUX_FORM_INTEGRATION_TARGET: "google_workspace",
        ...env
      },
      timeout: 30000,
      maxBuffer: 1024 * 1024
    });
    const output = `${stdout || ""}${stderr || ""}`;
    if (!expectOk) issue(`${label}: expected failure but passed`);
    if (expectedText && !output.includes(expectedText)) issue(`${label}: output missing "${expectedText}"`);
    assertNoSecretShape(label, output);
  } catch (error) {
    const output = `${error.stdout || ""}${error.stderr || ""}${error.message || ""}`;
    if (expectOk) issue(`${label}: expected success but failed: ${output.trim()}`);
    if (expectedText && !output.includes(expectedText)) issue(`${label}: failure output missing "${expectedText}"`);
    assertNoSecretShape(label, output);
  }
  const after = await snapshot();
  assertSnapshotUnchanged(before, after, label);
}

const [
  selectionRaw,
  profilesRaw,
  publicTermsRaw,
  pilotEvidenceRaw,
  buildRaw,
  requestJsonResult,
  requestMarkdownResult
] = await Promise.all([
  readFile("docs/private-workflow-selection.json", "utf8"),
  readFile("docs/private-integration-profiles.json", "utf8"),
  readFile("data/lux-public-terms.json", "utf8"),
  readFile("data/lux-pilot-write-evidence.json", "utf8"),
  readFile("data/lux-build-manifest.json", "utf8"),
  execFileAsync(node, ["tools/export-private-integration-request.mjs"], {
    env: { ...process.env, LUX_PRIVATE_INTEGRATION_PACKET_FORMAT: "json" },
    timeout: 30000,
    maxBuffer: 1024 * 1024 * 4
  }),
  execFileAsync(node, ["tools/export-private-integration-request.mjs"], {
    timeout: 30000,
    maxBuffer: 1024 * 1024 * 4
  })
]);

assertNoSecretShape("private workflow selection", selectionRaw);
assertNoSecretShape("private integration profiles", profilesRaw);
assertNoSecretShape("private integration request JSON", requestJsonResult.stdout);
assertNoSecretShape("private integration request markdown", requestMarkdownResult.stdout);

let selection = null;
let profiles = null;
let publicTerms = null;
let pilotEvidence = null;
let build = null;
let request = null;
try {
  selection = JSON.parse(selectionRaw);
  profiles = JSON.parse(profilesRaw);
  publicTerms = JSON.parse(publicTermsRaw);
  pilotEvidence = JSON.parse(pilotEvidenceRaw);
  build = JSON.parse(buildRaw);
  request = JSON.parse(requestJsonResult.stdout);
} catch (error) {
  issue(`invalid private workflow closeout JSON input: ${error?.message || String(error)}`);
}

if (selection?.schemaVersion !== "luxveritas.private_workflow_selection.v1") issue("private workflow selection schemaVersion mismatch");
if (selection?.selectionStatus !== "recommendation_ready_approval_required") issue("private workflow selection must remain approval-required before owner approval");
if (selection?.currentPrimaryTarget !== "firebase_handoff") issue("current primary target must remain firebase_handoff before external approval");
if (selection?.recommendedFirstExternalTarget !== "google_workspace") issue("recommended first external target must be google_workspace");

const googleProfile = profiles?.profiles?.find((profile) => profile.id === "google_workspace");
if (!googleProfile) {
  issue("missing google_workspace integration profile");
} else {
  if (googleProfile.status !== "future") issue("google_workspace must remain future before owner approval");
  if (googleProfile.targetSecretValue !== "google_workspace") issue("google_workspace targetSecretValue mismatch");
  if (googleProfile.publicExposure !== "none") issue("google_workspace publicExposure must be none");
}

const approval = selection?.recommendedFirstExternalApproval || {};
if (approval.status !== "identified_pending_explicit_private_workflow_owner_approval") {
  issue("google_workspace approval status must remain owner-approval pending");
}
if (approval.target !== "google_workspace" || approval.targetSecretValue !== "google_workspace") {
  issue("google_workspace approval target mismatch");
}
if (!/I approve google_workspace as the first external private workflow target/i.test(approval.approvalLanguage || "")) {
  issue("google_workspace approval language missing exact approval statement");
}
includesAll(approval.approvalScope || [], [
  "Approve google_workspace as the first external target only; do not activate ghl_crm or codex_ops from this approval.",
  "Approve server-side handoff only through Firebase Secret Manager.",
  "Keep firebase_handoff active as rollback until post-activation checks prove live writes and replay."
], "google_workspace approval scope");
includesAll(approval.privateValuesRequiredOutsideRepo || [], [
  "workflow owner",
  "receiver owner",
  "approved private receiver location",
  "approved signing material",
  "replay owner",
  "rollback owner",
  "retention expectation",
  "legal-version evidence owner"
], "google_workspace private approval values");
includesAll(approval.secretNamesOnly || [], [
  "FORM_INTEGRATION_URL",
  "FORM_INTEGRATION_SIGNING_SECRET",
  "FORM_INTEGRATION_TARGET"
], "google_workspace secret names");

const decisionIntake = selection?.approvalDecisionIntake || {};
includesAll(decisionIntake.requiredDecisionValues || [], ["approved", "needs_changes", "blocked"], "private workflow decision values");
includesAll(decisionIntake.requiredFields || [], [
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
], "private workflow decision fields");
if (!decisionIntake.blockApprovalIf?.some((item) => /public repo/i.test(item) && /Receiver location/i.test(item))) {
  issue("private workflow decision blockers must prevent public receiver/signing data");
}
if (!decisionIntake.blockApprovalIf?.some((item) => /activate ghl_crm or codex_ops/i.test(item))) {
  issue("private workflow decision blockers must prevent broader target activation");
}
if (!decisionIntake.noSecretEvidenceExamples?.some((item) => /without endpoint, token, account ID, or field ID/i.test(item))) {
  issue("private workflow decision evidence examples must be no-secret");
}

if (request?.schemaVersion !== "luxveritas.private_integration_request.v1") issue("private integration request schemaVersion mismatch");
const versionLock = request?.approvalDecisionIntake?.versionLock || {};
if (versionLock.recommendedTarget !== "google_workspace") issue("request version lock recommendedTarget mismatch");
if (versionLock.currentPrimaryTarget !== "firebase_handoff") issue("request version lock currentPrimaryTarget mismatch");
if (versionLock.assetVersion !== (build?.assetVersion || build?.version)) issue("request version lock assetVersion mismatch");
if (versionLock.pilotQaRunId !== pilotEvidence?.qaRunId) issue("request version lock pilot QA run mismatch");
if (versionLock.publicTermsVersion !== publicTerms?.version) issue("request version lock public terms mismatch");
if (versionLock.privacyVersion !== publicTerms?.privacyVersion) issue("request version lock privacy mismatch");
if (versionLock.termsVersion !== publicTerms?.termsVersion) issue("request version lock terms mismatch");
if (versionLock.submissionTermsVersion !== publicTerms?.submissionTermsVersion) issue("request version lock submission terms mismatch");

const activation = request?.recommendedExternalActivation || {};
if (activation.target !== "google_workspace") issue("recommended activation target mismatch");
if (activation.approvalRequired !== true) issue("recommended activation must require approval");
if (!activation.dryRunCommand?.includes("LUX_PRIVATE_INTEGRATION_ALLOW_FUTURE=1")) issue("recommended activation dry run missing approval flag");
if (!activation.activationCommand?.includes("LUX_FORM_INTEGRATION_TARGET='google_workspace'")) issue("recommended activation command missing google_workspace target");
includesAll(activation.postActivationChecks || [], [
  "node tools/qa-provider-readiness.mjs",
  "node tools/qa-live-operator-report.mjs",
  "LUX_FORM_MATRIX_WRITE=1 LUX_EXPECT_EMAIL_SENT=1 node tools/qa-live-form-matrix.mjs",
  "LUX_PILOT_WRITE_TESTS=1 node tools/qa-pilot-write-gate.mjs"
], "recommended activation post checks");
includesAll(activation.rollback || [], [
  "Return FORM_INTEGRATION_TARGET to firebase_handoff.",
  "Restore Firebase handoff receiver location and signing material through Firebase Secret Manager.",
  "Run provider readiness and live operator report QA after rollback."
], "recommended activation rollback");

await runActivation("google_workspace approval flag guard", {}, false, "google_workspace is marked future. Set LUX_PRIVATE_INTEGRATION_ALLOW_FUTURE=1 only after human approval.");
await runActivation("google_workspace approved dry-run closeout", {
  LUX_PRIVATE_INTEGRATION_ALLOW_FUTURE: "1"
}, true, "Dry run passed for private integration profile google_workspace");

if (issues.length) {
  console.error(`Private workflow approval closeout QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log("Private workflow approval closeout QA passed.");
