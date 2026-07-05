import { readFile } from "node:fs/promises";

const issues = [];
const warnings = [];
const handoff = await readFile("docs/production-release-handoff.md", "utf8");
const blockerResolution = await readFile("docs/launch-blocker-resolution.md", "utf8");
const launchCloseout = await readFile("data/lux-launch-closeout.json", "utf8");
const legalReviewPacket = await readFile("docs/legal-review-packet.md", "utf8");
const legalReview = JSON.parse(await readFile("data/lux-legal-review.json", "utf8"));
const finalLaunchRunbook = await readFile("docs/final-launch-runbook.md", "utf8");
const todo = await readFile("TODO.md", "utf8");
const pilotWriteEvidence = await readFile("data/lux-pilot-write-evidence.json", "utf8");
const pilotWriteEvidenceData = JSON.parse(pilotWriteEvidence);
const buildManifest = JSON.parse(await readFile("data/lux-build-manifest.json", "utf8"));
const finalGate = await readFile("tools/qa-final-release-gate.mjs", "utf8");
const pilotWriteGate = await readFile("tools/qa-pilot-write-gate.mjs", "utf8");
const writeReconciliation = await readFile("tools/qa-live-write-reconciliation.mjs", "utf8");
const activationDryRuns = await readFile("tools/qa-private-integration-activation-dry-runs.mjs", "utf8");
const legalApproved = ["privacy", "terms"].every((id) => (
  legalReview.items?.find((item) => item.id === id)?.status === "approved"
));

function issue(message) {
  issues.push(message);
}

function warn(message) {
  warnings.push(message);
}

for (const marker of [
  "https://luxveritas.media",
  "lux-veritas-media",
  "LuxVeritasMedia/luxveritas.media",
  buildManifest.assetVersion,
  "www.luxveritas.media",
  "firebase login --reauth --no-localhost",
  "RESEND_API_KEY",
  "forms@luxveritas.media",
  "External CRM/Google workflow target",
  "node tools/qa-provider-readiness.mjs",
  "node tools/qa-resend-inbox-activation-terminal.mjs",
  "node tools/qa-action-inventory.mjs",
  "node tools/qa-live-operator-report.mjs",
  "node tools/qa-external-workflow-targets.mjs",
  "node tools/qa-domain-readiness.mjs",
  "node tools/resolve-www-domain.mjs",
  "node tools/qa-release-readiness.mjs",
  "LUX_PILOT_WRITE_TESTS=1 node tools/qa-pilot-write-gate.mjs",
  "LUX_PILOT_BROWSER=1 LUX_PILOT_LIVE=1 node tools/qa-pilot-readiness.mjs",
  "node tools/qa-final-release-gate.mjs",
  "node tools/qa-operator-environment.mjs",
  "node tools/report-mvp-status.mjs",
  "node tools/qa-mvp-preflight.mjs",
  "node tools/qa-launch-evidence.mjs",
  "node tools/qa-pilot-write-evidence.mjs",
  "node tools/report-open-approvals.mjs",
  "node tools/qa-open-approvals.mjs",
  "docs/open-approval-decision-forms.md",
  "node tools/export-open-approval-decision-forms.mjs",
  "node tools/qa-open-approval-decision-forms.mjs",
  "node tools/qa-legal-approval-closeout.mjs",
  "node tools/qa-private-workflow-matrix.mjs",
  "node tools/qa-external-workflow-targets.mjs",
  "node tools/qa-private-workflow-selection.mjs",
  "node tools/qa-private-workflow-approval-closeout.mjs",
  "node tools/qa-private-integration-activation-dry-runs.mjs",
  "node tools/qa-live-media-sources.mjs",
  "node tools/qa-live-operator-report.mjs",
  "node tools/run-resend-inbox-activation-terminal.mjs",
  "LUX_FINAL_WRITE_TESTS=1 node tools/qa-final-release-gate.mjs",
  "Do not use `LUX_FINAL_SKIP_BROWSER=1` or `LUX_FINAL_SKIP_LIVE=1` for release approval.",
  "LUX_FORM_MATRIX_WRITE=1 LUX_EXPECT_EMAIL_SENT=1 node tools/qa-live-form-matrix.mjs"
]) {
  if (!handoff.includes(marker)) {
    if (marker === buildManifest.assetVersion) {
      warn(`production-release-handoff.md does not yet reference pending build asset ${marker}; rerun handoff docs after deploy/live pilot gate`);
    } else {
      issue(`production-release-handoff.md missing marker: ${marker}`);
    }
  }
}

for (const marker of legalApproved
  ? ["Privacy and Terms owner approval is recorded", "final release-gate verification active"]
  : ["Privacy page needs legal/business approval", "Terms page needs legal/business approval"]) {
  if (!handoff.includes(marker)) issue(`production-release-handoff.md missing legal-state marker: ${marker}`);
}

for (const marker of [
  "luxveritas.pilot_write_evidence.v1",
  "Post-Write Report Reconciliation",
  "formCaptureIntents",
  "eventWrites"
]) {
  if (!pilotWriteEvidence.includes(marker)) issue(`data/lux-pilot-write-evidence.json missing marker: ${marker}`);
}

for (const [label, doc] of [
  ["production-release-handoff.md", handoff],
  ["launch-blocker-resolution.md", blockerResolution],
  ["legal-review-packet.md", legalReviewPacket],
  ["final-launch-runbook.md", finalLaunchRunbook]
]) {
  for (const value of [
    pilotWriteEvidenceData.qaRunId,
    pilotWriteEvidenceData.assetVersion,
    String(pilotWriteEvidenceData.writeEvidence?.formCaptureIntents)
  ]) {
    if (!value || !doc.includes(value)) {
      issue(`${label} missing current pilot write evidence value: ${value || "missing"}`);
    }
  }
}

if (!handoff.includes("Use `docs/legal-review-packet.md` for Privacy and Terms review.")) {
  issue("production-release-handoff.md missing legal review packet pointer");
}
if (!handoff.includes("Use `docs/final-launch-runbook.md` for the exact final launch sequence.")) {
  issue("production-release-handoff.md missing final launch runbook pointer");
}

for (const marker of [
  "docs/launch-blocker-resolution.md",
  "data/lux-launch-closeout.json",
  "docs/private-workflow-selection.json",
  "node tools/qa-launch-closeout.mjs",
  "node tools/set-launch-closeout-status.mjs",
  "node tools/set-launch-readiness-status.mjs",
  "www Domain",
  "Inbox Provider",
  "Privacy Approval",
  "Terms Approval"
]) {
  if (!handoff.includes(marker) && !blockerResolution.includes(marker)) {
    issue(`launch blocker documentation missing marker: ${marker}`);
  }
}

for (const marker of [
  "luxveritas.launch_closeout.v1",
  "www_redirect",
  "inbox_notifications",
  "privacy_review",
  "terms_review"
]) {
  if (!launchCloseout.includes(marker)) {
    issue(`data/lux-launch-closeout.json missing marker: ${marker}`);
  }
}

for (const marker of [
  "node tools/qa-domain-readiness.mjs",
  "LUX_RESEND_API_KEY=\"re_...\" node tools/activate-inbox-delivery.mjs",
  "LUX_LEGAL_SYNC_LAUNCH=1",
  "LUX_LEGAL_EVIDENCE",
  "LUX_LEGAL_REVIEW_ITEM=privacy",
  "LUX_LEGAL_REVIEW_ITEM=terms",
  buildManifest.assetVersion,
  "LUX_PILOT_WRITE_TESTS=1 node tools/qa-pilot-write-gate.mjs",
  "LUX_PILOT_LIVE=1 LUX_PILOT_STRICT=1 node tools/qa-pilot-readiness.mjs",
  "LUX_FINAL_WRITE_TESTS=1 node tools/qa-final-release-gate.mjs"
]) {
  if (!blockerResolution.includes(marker)) {
    if (marker === buildManifest.assetVersion) {
      warn(`docs/launch-blocker-resolution.md does not yet reference pending build asset ${marker}; rerun handoff docs after deploy/live pilot gate`);
    } else {
      issue(`docs/launch-blocker-resolution.md missing marker: ${marker}`);
    }
  }
}

for (const marker of [
  "/legal/privacy.html",
  "/legal/terms.html",
  "data/lux-legal-review.json",
  "data/lux-public-terms.json",
  "Privacy Checklist",
  "Terms Checklist",
  "node tools/export-legal-review-request.mjs",
  "node tools/qa-legal-review-request.mjs",
  "LUX_LEGAL_SYNC_LAUNCH=1",
  "LUX_LEGAL_EVIDENCE",
  "LUX_LEGAL_REVIEW_ITEM=privacy",
  "LUX_LEGAL_REVIEW_ITEM=terms"
]) {
  if (!legalReviewPacket.includes(marker)) {
    issue(`docs/legal-review-packet.md missing marker: ${marker}`);
  }
}

for (const marker of [
  "Lux Veritas Final Launch Runbook",
  "node tools/qa-operator-environment.mjs",
  "node tools/report-mvp-status.mjs",
  "node tools/qa-mvp-preflight.mjs",
  "node tools/qa-launch-evidence.mjs",
  "node tools/qa-pilot-write-evidence.mjs",
  "node tools/report-open-approvals.mjs",
  "node tools/qa-open-approvals.mjs",
  "node tools/qa-open-approval-decision-forms.mjs",
  "node tools/qa-legal-approval-closeout.mjs",
  "node tools/qa-action-inventory.mjs",
  "node tools/qa-deploy-status.mjs",
  "node tools/qa-live-assets.mjs",
  "node tools/qa-live-media-sources.mjs",
  "node tools/qa-domain-readiness.mjs",
  "node tools/resolve-www-domain.mjs",
  "node tools/run-resend-inbox-activation-terminal.mjs",
  "LUX_RESEND_API_KEY=\"re_...\" node tools/activate-inbox-delivery.mjs",
  "node tools/export-legal-review-request.mjs",
  "node tools/qa-legal-review-request.mjs",
  "node tools/export-private-integration-request.mjs",
  "node tools/qa-private-integration-field-map.mjs",
  "node tools/qa-private-workflow-matrix.mjs",
  "node tools/qa-private-workflow-selection.mjs",
  "node tools/qa-private-workflow-approval-closeout.mjs",
  "LUX_PRIVATE_INTEGRATION_PACKET_OUT=/tmp/lux-private-integration-request.md",
  "LUX_LEGAL_SYNC_LAUNCH=1",
  "LUX_LEGAL_EVIDENCE",
  "LUX_LEGAL_REVIEW_ITEM=privacy",
  "LUX_LEGAL_REVIEW_ITEM=terms",
  "LUX_FINAL_WRITE_TESTS=1 node tools/qa-final-release-gate.mjs",
  "LUX_PILOT_WRITE_TESTS=1 node tools/qa-pilot-write-gate.mjs",
  "LUX_PILOT_WRITE_DRY_RUN=1 node tools/qa-pilot-write-gate.mjs",
  "data/lux-pilot-write-evidence.json",
  "QA run ID",
  "reconciles the exact write-run IDs",
  "Do Not Ship If",
  "Replay pending inbox notifications"
]) {
  if (!finalLaunchRunbook.includes(marker)) {
    issue(`docs/final-launch-runbook.md missing marker: ${marker}`);
  }
}

for (const marker of [
  "Operator Environment",
  "tools/qa-operator-environment.mjs",
  "MVP Status",
  "tools/qa-mvp-status.mjs",
  "LUX_MVP_STATUS_REQUIRE_CURRENT_PILOT",
  "LUX_PILOT_WRITE_EVIDENCE_STRICT",
  "LUX_LIVE_SITE_REQUIRE_CURRENT_PILOT",
  "MVP Preflight",
  "tools/qa-mvp-preflight.mjs",
  "Launch Evidence",
  "tools/qa-launch-evidence.mjs",
  "Open Approvals",
  "tools/qa-open-approvals.mjs",
  "Open Approval Decision Forms",
  "tools/qa-open-approval-decision-forms.mjs",
  "Private Workflow Approval Closeout",
  "tools/qa-private-workflow-approval-closeout.mjs",
  "Legal Approval Closeout",
  "tools/qa-legal-approval-closeout.mjs",
  "Legal Sync",
  "tools/qa-legal-sync.mjs",
  "Deploy Status",
  "Domain Readiness",
  "Provider Readiness",
  "Resend Inbox Activation Terminal",
  "tools/qa-resend-inbox-activation-terminal.mjs",
  "Live Operator Report",
  "Release Readiness",
  "Full Pilot Readiness",
  "Final Write Tests"
]) {
  if (!finalGate.includes(marker)) {
    issue(`tools/qa-final-release-gate.mjs missing marker: ${marker}`);
  }
}

for (const marker of [
  "Lux Veritas pilot write gate",
  "LUX_PILOT_WRITE_TESTS",
  "LUX_PILOT_WRITE_DRY_RUN",
  "Live Form Write Matrix",
  "Live Event Write Matrix",
  "Post-Write Report Reconciliation",
  "Live Browser Flows",
  "Live Operator Report",
  "tools/qa-live-write-reconciliation.mjs",
  "Release Readiness",
  "allowLegalOnly",
  "Privacy page legal review (complete|is approved|is not approved)",
  "Terms page legal review (complete|is approved|is not approved)"
]) {
  if (!pilotWriteGate.includes(marker)) {
    issue(`tools/qa-pilot-write-gate.mjs missing marker: ${marker}`);
  }
}

for (const marker of [
  "Private integration activation dry-run QA",
  "LUX_PRIVATE_INTEGRATION_ACTIVATION_DRY_RUN",
  "LUX_PRIVATE_INTEGRATION_ALLOW_FUTURE",
  "LUX_FORM_INTEGRATION_TARGET",
  "ghl_crm",
  "google_workspace",
  "codex_ops",
  "future profile dry run passed without"
]) {
  if (!activationDryRuns.includes(marker)) {
    issue(`tools/qa-private-integration-activation-dry-runs.mjs missing marker: ${marker}`);
  }
}

for (const marker of [
  "Live write reconciliation",
  "LUX_QA_RUN_ID",
  "LV-MATRIX-",
  "LV-EVENT-MATRIX-",
  "fan_reaction",
  "spmvp_release_audio",
  "latest.submissions",
  "latest.events",
  "latest.handoffs"
]) {
  if (!writeReconciliation.includes(marker)) {
    issue(`tools/qa-live-write-reconciliation.mjs missing marker: ${marker}`);
  }
}

for (const marker of [
  "export-launch-evidence",
  "LUX_EVIDENCE_LIVE=1",
  "LUX_EVIDENCE_OUT=/tmp/lux-launch-evidence.md"
]) {
  if (!finalLaunchRunbook.includes(marker) && !handoff.includes(marker)) {
    issue(`launch evidence docs missing marker: ${marker}`);
  }
}

for (const marker of [
  "Close the www.luxveritas.media launch gate after Firebase certificate/Hosting mapping returned HTTP 200",
  "Configure and verify email provider runtime secret `RESEND_API_KEY`",
  "Add legal review packet for Privacy and Terms approval",
  "Add final strict release-gate command for launch-day acceptance",
  "Add dedicated pilot write gate for TestFlight-quality live submissions",
  "Add post-write protected report reconciliation",
  "Record current live pilot write-gate evidence for the deployed asset version",
  "Add no-secret private workflow selection packet recommending Google Workspace first while Firebase handoff remains active",
  "Add private integration activation dry-run QA",
  "Add Google Workspace first-activation packet with approval fields, dry-run command, live acceptance checks, and Firebase rollback",
  "Require final release-gate write mode for launch-day approval",
  "Require browser and live coverage in final release-gate approval mode",
  "Add final launch runbook for DNS, inbox, legal, write tests, and gate approval",
  "Legal review: Privacy",
  "Legal review: Terms",
  "Approve and configure `google_workspace` as the first external private workflow target"
]) {
  if (!todo.includes(marker)) issue(`TODO.md missing launch blocker marker: ${marker}`);
}

if (/re_[A-Za-z0-9_-]{8,}/.test(handoff)) {
  issue("production-release-handoff.md appears to contain a real Resend key");
}

if (/REPORT_OPERATOR_TOKEN=|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}/.test(handoff)) {
  issue("production-release-handoff.md appears to contain a private report token");
}

const blockerLiveVersion = blockerResolution.match(/Live build version:\s*`([^`]+)`/)?.[1] || "";
if (blockerLiveVersion !== buildManifest.assetVersion) {
  warn(`docs/launch-blocker-resolution.md live build version ${blockerLiveVersion || "missing"} does not match pending build ${buildManifest.assetVersion}; expected before deploy`);
}

if (issues.length) {
  console.error(`Release handoff QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

if (warnings.length) {
  console.warn("Release handoff QA warnings:");
  for (const item of warnings) console.warn(`- ${item}`);
}

console.log("Release handoff QA passed.");
