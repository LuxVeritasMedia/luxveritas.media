import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const issues = [];
const identifiedDeployServiceAccount = "github-actions-firebase@lux-veritas-media.iam.gserviceaccount.com";
const targetServiceAccount = "lux-veritas-media@appspot.gserviceaccount.com";
const requiredRole = "roles/iam.serviceAccountUser";
const exactApprovalLanguage = `I approve granting ${requiredRole} on ${targetServiceAccount} to ${identifiedDeployServiceAccount} for the LuxVeritasMedia/luxveritas.media manual Firebase Functions deploy workflow.`;

function issue(message) {
  issues.push(message);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function secretShape(value) {
  let checked = value;
  for (const allowed of [
    identifiedDeployServiceAccount,
    `serviceAccount:${identifiedDeployServiceAccount}`,
    targetServiceAccount,
    `serviceAccount:${targetServiceAccount}`
  ]) {
    checked = checked.replace(new RegExp(escapeRegex(allowed), "g"), "KNOWN_NON_SECRET_IAM_PRINCIPAL");
  }
  return /\bre_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}|REPORT_OPERATOR_TOKEN=.*[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{16,}|serviceAccount:[^<\s]+@[^<\s]+\.iam\.gserviceaccount\.com/i.test(checked);
}

const [markdownResult, jsonResult] = await Promise.all([
  execFileAsync(process.execPath, ["tools/export-functions-iam-repair-request.mjs"], {
    timeout: 30000,
    maxBuffer: 1024 * 1024 * 2
  }),
  execFileAsync(process.execPath, ["tools/export-functions-iam-repair-request.mjs"], {
    env: { ...process.env, LUX_FUNCTIONS_IAM_PACKET_FORMAT: "json" },
    timeout: 30000,
    maxBuffer: 1024 * 1024 * 2
  })
]);

const markdown = markdownResult.stdout;
const jsonRaw = jsonResult.stdout;

if (secretShape(markdown) || secretShape(jsonRaw)) {
  issue("Functions IAM repair request appears to contain secret-shaped data");
}

for (const marker of [
  "# Lux Veritas Functions IAM Repair Request",
  "No-secret repair request",
  "lux-veritas-media",
  "LuxVeritasMedia/luxveritas.media",
  "firebase-functions-manual.yml",
  "lux-veritas-media@appspot.gserviceaccount.com",
  "roles/iam.serviceAccountUser",
  "iam.serviceAccounts.ActAs",
  "GCP_SERVICE_ACCOUNT",
  "GCP_WORKLOAD_IDENTITY_PROVIDER",
  "GitHub secret values cannot be read back",
  identifiedDeployServiceAccount,
  "identified_pending_explicit_project_owner_approval",
  "Read-only IAM inspection identified",
  "Identified Principal Evidence",
  "Exact Approval Language",
  exactApprovalLanguage,
  "Security approval is required before any agent",
  "Cloud Console Repair",
  "Unknown Principal Recovery",
  "do not guess a new deploy service account principal",
  "APPROVED_DEPLOY_SERVICE_ACCOUNT_EMAIL",
  "gh secret set GCP_SERVICE_ACCOUNT --repo LuxVeritasMedia/luxveritas.media",
  "Do not create, download, upload, paste, or commit service-account JSON keys.",
  "gcloud iam service-accounts add-iam-policy-binding",
  `serviceAccount:${identifiedDeployServiceAccount}`,
  "node tools/qa-functions-deploy-readiness.mjs",
  "node tools/qa-provider-readiness.mjs",
  "Do not paste service-account JSON keys",
  "Do not add a self-repair IAM workflow"
]) {
  if (!markdown.includes(marker)) issue(`markdown repair request missing marker: ${marker}`);
}

let packet = null;
try {
  packet = JSON.parse(jsonRaw);
} catch (error) {
  issue(`Functions IAM repair request JSON is invalid: ${error?.message || String(error)}`);
}

if (packet) {
  if (packet.schemaVersion !== "luxveritas.functions_iam_repair_request.v1") issue("schemaVersion mismatch");
  if (packet.project !== "lux-veritas-media") issue("project mismatch");
  if (packet.githubRepo !== "LuxVeritasMedia/luxveritas.media") issue("repo mismatch");
  if (packet.workflow !== "firebase-functions-manual.yml") issue("workflow mismatch");
  if (!packet.assetVersion) issue("assetVersion missing");
  if (packet.blocker?.status !== "external_iam_grant_required") issue("blocker status mismatch");
  if (packet.blocker?.requiredPermission !== "iam.serviceAccounts.ActAs") issue("required permission mismatch");
  if (packet.blocker?.requiredRole !== "roles/iam.serviceAccountUser") issue("required role mismatch");
  if (packet.blocker?.targetServiceAccount !== "lux-veritas-media@appspot.gserviceaccount.com") issue("target service account mismatch");
  if (packet.blocker?.principalSecretName !== "GCP_SERVICE_ACCOUNT") issue("principal secret name mismatch");
  if (packet.blocker?.providerSecretName !== "GCP_WORKLOAD_IDENTITY_PROVIDER") issue("provider secret name mismatch");
  if (!packet.knownFacts?.some((item) => /Security approval is required/i.test(item))) {
    issue("knownFacts missing security approval requirement");
  }
  if (packet.blocker?.identifiedPrincipal?.serviceAccount !== identifiedDeployServiceAccount) {
    issue("identified deploy service account mismatch");
  }
  if (packet.blocker?.identifiedPrincipal?.status !== "identified_pending_explicit_project_owner_approval") {
    issue("identified principal status mismatch");
  }
  if (!packet.blocker?.identifiedPrincipal?.evidence?.some((item) => /Workload Identity User binding/i.test(item))) {
    issue("identified principal evidence missing Workload Identity binding proof");
  }
  if (packet.exactApprovalLanguage !== exactApprovalLanguage) {
    issue("exact approval language mismatch");
  }
  if (packet.unknownPrincipalRecovery?.status !== "identified_principal_ready_for_explicit_approval") {
    issue("principal recovery status mismatch");
  }
  if (!packet.unknownPrincipalRecovery?.rule?.includes("do not guess")) {
    issue("principal recovery rule missing no-guessing guard");
  }
  for (const marker of [
    identifiedDeployServiceAccount,
    "Workload Identity provider",
    "without creating a JSON key",
    "Replace GitHub Actions secret GCP_SERVICE_ACCOUNT",
    "Rerun firebase-functions-manual.yml"
  ]) {
    if (!packet.unknownPrincipalRecovery?.steps?.some((item) => item.includes(marker))) {
      issue(`unknown principal recovery missing step marker: ${marker}`);
    }
  }
  if (!packet.unknownPrincipalRecovery?.githubSecretRotationTemplate?.includes("gh secret set GCP_SERVICE_ACCOUNT --repo LuxVeritasMedia/luxveritas.media")) {
    issue("unknown principal recovery missing GitHub secret rotation template");
  }
  if (!packet.unknownPrincipalRecovery?.keyPolicy?.includes("service-account JSON keys")) {
    issue("unknown principal recovery missing service-account key policy");
  }
  if (!packet.cloudConsole?.url?.includes("iam-admin/serviceaccounts/details/lux-veritas-media@appspot.gserviceaccount.com/permissions")) {
    issue("cloud console URL mismatch");
  }
  for (const command of [
    ".codex-tools/gh-local/bin/gh workflow run firebase-functions-manual.yml --repo LuxVeritasMedia/luxveritas.media",
    "node tools/qa-functions-deploy-readiness.mjs",
    "node tools/qa-provider-readiness.mjs",
    "node tools/qa-live-site.mjs"
  ]) {
    if (!packet.verificationCommands?.includes(command)) issue(`verification command missing: ${command}`);
  }
  for (const criterion of [
    "Latest manual Functions deploy completes successfully.",
    "Functions deploy readiness reports 0 deploy blockers."
  ]) {
    if (!packet.successCriteria?.includes(criterion)) issue(`success criterion missing: ${criterion}`);
  }
  if (!packet.doNotInclude?.some((item) => /service-account JSON keys/i.test(item))) {
    issue("doNotInclude missing service-account key warning");
  }
  if (!packet.doNotInclude?.some((item) => /self-repair IAM workflow/i.test(item))) {
    issue("doNotInclude missing self-repair IAM workflow approval warning");
  }
}

if (issues.length) {
  console.error(`Functions IAM repair request QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log("Functions IAM repair request QA passed.");
