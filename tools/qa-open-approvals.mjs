import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const issues = [];

function issue(message) {
  issues.push(message);
}

function secretShape(value) {
  return /\bre_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}|REPORT_OPERATOR_TOKEN=.*[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{16,}|serviceAccount:[^<\s]+@[^<\s]+\.iam\.gserviceaccount\.com/i.test(value);
}

const [textResult, jsonResult, legalRaw, publicTermsRaw, workflowSelectionRaw, privateUploadRaw, pilotEvidenceRaw, exportedRaw] = await Promise.all([
  execFileAsync(process.execPath, ["tools/report-open-approvals.mjs"], {
    timeout: 30000,
    maxBuffer: 1024 * 1024 * 4
  }),
  execFileAsync(process.execPath, ["tools/report-open-approvals.mjs"], {
    env: { ...process.env, LUX_OPEN_APPROVALS_JSON: "1" },
    timeout: 30000,
    maxBuffer: 1024 * 1024 * 4
  }),
  readFile("data/lux-legal-review.json", "utf8"),
  readFile("data/lux-public-terms.json", "utf8"),
  readFile("docs/private-workflow-selection.json", "utf8"),
  readFile("docs/private-upload-manifest.json", "utf8"),
  readFile("data/lux-pilot-write-evidence.json", "utf8"),
  readFile("data/lux-open-approvals.json", "utf8")
]);

const text = textResult.stdout;
const jsonRaw = jsonResult.stdout;
const exported = JSON.parse(exportedRaw);
const legal = JSON.parse(legalRaw);
const publicTerms = JSON.parse(publicTermsRaw);
const workflowSelection = JSON.parse(workflowSelectionRaw);
const privateUpload = JSON.parse(privateUploadRaw);
const pilotEvidence = JSON.parse(pilotEvidenceRaw);

if (secretShape(`${text}\n${jsonRaw}`)) {
  issue("open approvals report appears to contain secret-shaped data");
}
if (secretShape(exportedRaw)) {
  issue("exported open approvals manifest appears to contain secret-shaped data");
}

for (const marker of [
  "Lux Veritas open approvals report",
  "Decision: external_approvals_pending",
  "Privacy Review",
  "Terms Review",
  "Functions Deploy IAM",
  "External Workflow Target",
  "Seed/Binder Private Upload",
  "Event Terms",
  "Purchase/Membership Terms",
  "blocks public launch",
  "node tools/qa-release-readiness.mjs",
  "node tools/qa-functions-deploy-readiness.mjs",
  "node tools/qa-private-workflow-selection.mjs",
  "node tools/qa-private-upload-manifest.mjs"
]) {
  if (!text.includes(marker)) issue(`text report missing marker: ${marker}`);
}

let report = null;
try {
  report = JSON.parse(jsonRaw);
} catch (error) {
  issue(`open approvals JSON is invalid: ${error?.message || String(error)}`);
}

if (report) {
  const exportedStable = { ...exported, generatedAt: "" };
  const reportStable = { ...report, generatedAt: "" };
  if (JSON.stringify(exportedStable) !== JSON.stringify(reportStable)) {
    issue("data/lux-open-approvals.json does not match generated open approvals JSON");
  }
  if (report.schemaVersion !== "luxveritas.open_approvals_report.v1") issue("schemaVersion mismatch");
  if (report.project !== "LuxVeritas.media") issue("project mismatch");
  if (report.liveUrl !== "https://luxveritas.media") issue("liveUrl mismatch");
  if (report.decision !== "external_approvals_pending") issue("decision should remain external_approvals_pending while legal is open");
  if (report.pilotEvidence?.qaRunId !== pilotEvidence.qaRunId) issue("pilot qaRunId mismatch");
  if (report.pilotEvidence?.formCaptureIntents !== pilotEvidence.writeEvidence?.formCaptureIntents) issue("pilot form count mismatch");
  if (!Array.isArray(report.approvals) || report.approvals.length < 6) issue("approval list is incomplete");

  const approvals = new Map((report.approvals || []).map((item) => [item.id, item]));
  for (const item of report.approvals || []) {
    const intake = item.decisionIntake;
    if (!intake) {
      issue(`${item.id}: missing decisionIntake`);
      continue;
    }
    if (intake.approvalId !== item.id) issue(`${item.id}: decisionIntake approvalId mismatch`);
    for (const value of ["approved", "needs_changes", "blocked"]) {
      if (!intake.requiredDecisionValues?.includes(value)) issue(`${item.id}: decisionIntake missing decision value ${value}`);
    }
    for (const field of ["approvalId", "reviewerName", "reviewedAt", "decision", "evidenceReference", "conditionsOrChanges"]) {
      if (!intake.requiredFields?.includes(field)) issue(`${item.id}: decisionIntake missing required field ${field}`);
    }
    if (!/outside the public repo/i.test(intake.purpose || "")) issue(`${item.id}: decisionIntake purpose must keep decision record outside public repo`);
    if (!intake.blockApprovalIf?.some((entry) => /secrets|API keys|private URLs/i.test(entry))) {
      issue(`${item.id}: decisionIntake missing no-secret blocker`);
    }
    if (!intake.noSecretEvidenceExamples?.some((entry) => /without.*private/i.test(entry) || /only public/i.test(entry))) {
      issue(`${item.id}: decisionIntake missing no-secret evidence example`);
    }
  }

  for (const id of ["privacy_review", "terms_review"]) {
    const item = approvals.get(id);
    const legalItem = legal.items.find((entry) => entry.id === id.replace("_review", ""));
    if (!item) {
      issue(`missing approval item ${id}`);
      continue;
    }
    if (item.blocksPublicLaunch !== true) issue(`${id} must block public launch`);
    if (item.status !== "open") issue(`${id} should be open while legal status is ${legalItem?.status || "missing"}`);
    if (!item.notes?.includes(legalItem?.version)) issue(`${id} missing legal version note`);
    if (item.decisionIntake?.versionLock?.legalVersion !== legalItem?.version) issue(`${id} decisionIntake legal version mismatch`);
    if (item.decisionIntake?.versionLock?.publicTermsVersion !== publicTerms.version) issue(`${id} decisionIntake public terms version mismatch`);
  }

  const privacy = approvals.get("privacy_review");
  if (privacy) {
    if (privacy.decisionIntake?.versionLock?.privacyVersion !== publicTerms.privacyVersion) issue("privacy decisionIntake privacy version mismatch");
    if (!privacy.decisionIntake?.requiredFields?.includes("privacyVersion")) issue("privacy decisionIntake missing privacyVersion field");
    if (!privacy.decisionIntake?.blockApprovalIf?.some((item) => /live Privacy page differs/i.test(item))) {
      issue("privacy decisionIntake missing live route/version blocker");
    }
  }

  const terms = approvals.get("terms_review");
  if (terms) {
    if (terms.decisionIntake?.versionLock?.termsVersion !== publicTerms.termsVersion) issue("terms decisionIntake terms version mismatch");
    if (terms.decisionIntake?.versionLock?.submissionTermsVersion !== publicTerms.submissionTermsVersion) issue("terms decisionIntake submission terms version mismatch");
    if (!terms.decisionIntake?.requiredFields?.includes("submissionTermsVersion")) issue("terms decisionIntake missing submissionTermsVersion field");
    if (!terms.decisionIntake?.blockApprovalIf?.some((item) => /live Terms page differs/i.test(item))) {
      issue("terms decisionIntake missing live route/version blocker");
    }
  }

  for (const id of ["functions_deploy_iam", "external_workflow_target", "seed_binder_private_upload", "event_terms", "purchase_membership_terms"]) {
    const item = approvals.get(id);
    if (!item) {
      issue(`missing approval item ${id}`);
      continue;
    }
    if (item.blocksPublicLaunch !== false) issue(`${id} must not block public launch`);
  }

  const functionsIam = approvals.get("functions_deploy_iam");
  if (functionsIam) {
    if (functionsIam.decisionIntake?.versionLock?.iamRole !== "roles/iam.serviceAccountUser") issue("functions IAM decisionIntake role mismatch");
    if (!functionsIam.decisionIntake?.requiredFields?.includes("projectOwner")) issue("functions IAM decisionIntake missing projectOwner field");
    if (!functionsIam.decisionIntake?.blockApprovalIf?.some((item) => /service account key/i.test(item))) {
      issue("functions IAM decisionIntake missing service-account-key blocker");
    }
  }

  const external = approvals.get("external_workflow_target");
  if (external && !external.notes?.some((item) => item.includes(workflowSelection.recommendedFirstExternalTarget))) {
    issue("external workflow target missing recommended target note");
  }
  if (external && !external.nextAction?.includes("Approve google_workspace as the first external private workflow target")) {
    issue("external workflow target next action missing exact google_workspace approval");
  }
  if (external && !external.nextAction?.includes("firebase_handoff as rollback")) {
    issue("external workflow target next action missing firebase_handoff rollback");
  }
  if (external && !external.notes?.includes(workflowSelection.recommendedFirstExternalApproval?.status)) {
    issue("external workflow target missing first external approval status note");
  }
  if (external) {
    if (external.decisionIntake?.versionLock?.recommendedTarget !== workflowSelection.recommendedFirstExternalTarget) {
      issue("external workflow target decisionIntake recommended target mismatch");
    }
    if (external.decisionIntake?.versionLock?.currentPrimaryTarget !== workflowSelection.currentPrimaryTarget) {
      issue("external workflow target decisionIntake current target mismatch");
    }
    for (const field of ["receiverLocationEvidence", "signingMaterialEvidence", "legalVersionEvidenceOwner"]) {
      if (!external.decisionIntake?.requiredFields?.includes(field)) {
        issue(`external workflow target decisionIntake missing ${field}`);
      }
    }
  }

  const upload = approvals.get("seed_binder_private_upload");
  if (upload) {
    if (upload.source !== "docs/private-upload-manifest.json") issue("seed/binder upload approval should source private-upload-manifest.json");
    if (!upload.verification?.includes("node tools/qa-private-upload-manifest.mjs")) issue("seed/binder upload approval missing manifest QA verification");
    if (!upload.notes?.some((item) => item.includes(privateUpload.recommendedFolderName))) issue("seed/binder upload approval missing folder note");
    if (!upload.notes?.some((item) => item.includes(privateUpload.shareTarget))) issue("seed/binder upload approval missing share target note");
    if (!upload.notes?.includes(privateUpload.recommendedUploadApproval?.status)) issue("seed/binder upload approval missing exact approval status note");
    if (!upload.nextAction?.includes("Approve uploading the curated Lux Veritas Website Build package")) {
      issue("seed/binder upload approval missing exact upload approval action");
    }
    if (!upload.nextAction?.includes("exclude source zips, local caches, secrets")) {
      issue("seed/binder upload approval missing exclusion boundary");
    }
    if (/LuxFlow/i.test(upload.nextAction || "")) {
      issue("seed/binder upload approval public next action exposes internal product term");
    }
    if (upload.decisionIntake?.versionLock?.recommendedFolderName !== privateUpload.recommendedFolderName) {
      issue("seed/binder upload decisionIntake folder mismatch");
    }
    if (!upload.decisionIntake?.requiredFields?.includes("exclusionEvidence")) {
      issue("seed/binder upload decisionIntake missing exclusionEvidence");
    }
    if (!upload.decisionIntake?.blockApprovalIf?.some((item) => /source zip archives/i.test(item))) {
      issue("seed/binder upload decisionIntake missing source-zip exclusion blocker");
    }
  }

  const eventTerms = approvals.get("event_terms");
  if (eventTerms && eventTerms.decisionIntake?.versionLock?.currentPublicEventMode !== "request_access_only") {
    issue("event terms decisionIntake current mode mismatch");
  }

  const purchaseTerms = approvals.get("purchase_membership_terms");
  if (purchaseTerms && purchaseTerms.decisionIntake?.versionLock?.currentPublicCommerceMode !== "waitlist_only") {
    issue("purchase/membership terms decisionIntake current mode mismatch");
  }

  if (report.counts?.publicLaunchBlockers !== 2) issue("public launch blocker count should be 2");
  if ((report.counts?.totalOpenOrConditional || 0) < 6) issue("open/conditional approval count is too low");
}

if (issues.length) {
  console.error(`Open approvals QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log("Open approvals QA passed.");
