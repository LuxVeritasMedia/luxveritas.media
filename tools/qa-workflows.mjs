import { readFile } from "node:fs/promises";

const issues = [];
const hosting = await readFile(".github/workflows/firebase-hosting-live.yml", "utf8");
const hostingPreview = await readFile(".github/workflows/firebase-hosting-preview.yml", "utf8");
const hostingPreviewDeploy = await readFile(".github/workflows/firebase-hosting-preview-deploy.yml", "utf8");
const functions = await readFile(".github/workflows/firebase-functions-manual.yml", "utf8");
const finalAudit = await readFile(".github/workflows/final-release-audit.yml", "utf8");
const deployStatus = await readFile("tools/qa-deploy-status.mjs", "utf8");
const functionsDeployReadiness = await readFile("tools/qa-functions-deploy-readiness.mjs", "utf8");
const functionsIamRepairRequest = await readFile("tools/qa-functions-iam-repair-request.mjs", "utf8");
const functionsIamRepairExport = await readFile("tools/export-functions-iam-repair-request.mjs", "utf8");
const openApprovals = await readFile("tools/report-open-approvals.mjs", "utf8");
const openApprovalsQa = await readFile("tools/qa-open-approvals.mjs", "utf8");
const openApprovalDecisionFormsExport = await readFile("tools/export-open-approval-decision-forms.mjs", "utf8");
const openApprovalDecisionFormsQa = await readFile("tools/qa-open-approval-decision-forms.mjs", "utf8");
const legalApprovalCloseoutQa = await readFile("tools/qa-legal-approval-closeout.mjs", "utf8");
const inboxActivation = await readFile("tools/activate-inbox-delivery.mjs", "utf8");
const resendDomainReadiness = await readFile("tools/qa-resend-domain-readiness.mjs", "utf8");
const resendActivationTerminal = await readFile("tools/run-resend-inbox-activation-terminal.mjs", "utf8");
const resendActivationTerminalQa = await readFile("tools/qa-resend-inbox-activation-terminal.mjs", "utf8");
const privateIntegrationActivation = await readFile("tools/activate-private-integration.mjs", "utf8");
const privateWorkflowApprovalCloseout = await readFile("tools/qa-private-workflow-approval-closeout.mjs", "utf8");
const wwwResolver = await readFile("tools/resolve-www-domain.mjs", "utf8");
const firebaseDeployAuth = await readFile("tools/qa-firebase-deploy-auth.mjs", "utf8");
const firebaseCiTokenSetup = await readFile("tools/setup-firebase-ci-token.mjs", "utf8");
const firebaseRestDeploy = await readFile("tools/deploy-firebase-hosting-rest.mjs", "utf8");
const googleCloudAuth = await readFile("tools/lib/google-cloud-auth.mjs", "utf8");
const finalLaunchRunbook = await readFile("docs/final-launch-runbook.md", "utf8");
const workflowBundle = `${hosting}\n${hostingPreview}\n${hostingPreviewDeploy}\n${functions}\n${finalAudit}`;

for (const marker of [
  "concurrency:",
  "group: firebase-hosting-live",
  "timeout-minutes: 20",
  "Preflight Firebase deploy auth",
  "node tools/qa-firebase-deploy-auth.mjs",
  "node tools/qa-buttons.mjs",
  "node tools/qa-action-inventory.mjs",
  "node tools/qa-public-site.mjs",
  "node tools/qa-access-model.mjs",
  "node tools/qa-integrations.mjs",
  "node tools/qa-integration-contract.mjs",
  "node tools/qa-integration-profiles.mjs",
  "node tools/qa-private-integration-field-map.mjs",
  "node tools/qa-private-workflow-matrix.mjs",
  "node tools/qa-external-workflow-targets.mjs",
  "node tools/qa-private-workflow-selection.mjs",
  "node tools/qa-private-integration-request.mjs",
  "node tools/qa-private-workflow-approval-closeout.mjs",
  "node tools/qa-legal-sync.mjs",
  "node tools/qa-legal-approval-closeout.mjs",
  "node tools/qa-release-handoff.mjs",
  "node tools/qa-action-inventory.mjs",
  "node tools/qa-launch-closeout.mjs",
  "node tools/qa-launch-blockers.mjs",
  "node tools/qa-open-approvals.mjs",
  "node tools/qa-open-approval-decision-forms.mjs",
  "node tools/qa-mvp-status.mjs",
  "node tools/qa-launch-evidence.mjs",
  "node tools/qa-pilot-write-evidence.mjs",
  "node tools/qa-pilot-bug-register.mjs",
  "node tools/qa-media-contract.mjs",
  "node tools/qa-fan-signal.mjs",
  "node tools/qa-mobile-layout.mjs",
  "node tools/qa-accessibility.mjs",
  "node tools/qa-hosting-config.mjs",
  "node tools/qa-release-readiness.mjs",
  "node tools/qa-domain-readiness.mjs",
  "node tools/qa-provider-readiness.mjs",
  "node tools/qa-resend-inbox-activation-terminal.mjs",
  "npm install --no-save playwright",
  "npx playwright install chromium",
  "node tools/qa-browser-flows.mjs",
  "npx firebase-tools@15.22.1 deploy --only hosting",
  "node tools/deploy-firebase-hosting-rest.mjs",
  "FIREBASE_CI_TOKEN: ${{ secrets.FIREBASE_CI_TOKEN }}",
  "--token \"$FIREBASE_CI_TOKEN\"",
  "else",
  "node tools/qa-live-site.mjs",
  "node tools/qa-live-operator-report.mjs",
  "node tools/qa-live-assets.mjs",
  "node tools/qa-live-media-sources.mjs",
  "node tools/qa-live-form-matrix.mjs",
  "node tools/qa-live-event-matrix.mjs",
  "node tools/qa-live-product-boundary.mjs",
  "node tools/qa-deploy-status.mjs",
  "LUX_BROWSER_BASE_URL=https://luxveritas.media node tools/qa-browser-flows.mjs"
]) {
  if (!hosting.includes(marker)) issues.push(`firebase-hosting-live.yml: missing ${marker}`);
}

for (const marker of [
  "actions/checkout@v5",
  "actions/setup-node@v5"
]) {
  if (!workflowBundle.includes(marker)) issues.push(`workflows: missing ${marker}`);
}

if (workflowBundle.includes("token_format: access_token")) {
  issues.push("workflows: do not pass Google access tokens to Firebase CLI --token");
}

if (workflowBundle.includes("steps.google-auth.outputs.access_token")) {
  issues.push("workflows: Firebase CLI token fallback must use secrets.FIREBASE_CI_TOKEN, not Google auth output");
}

for (const deprecatedAction of [
  "actions/checkout@v4",
  "actions/setup-node@v4"
]) {
  if (workflowBundle.includes(deprecatedAction)) {
    issues.push(`workflows: replace deprecated Node 20 action ${deprecatedAction}`);
  }
}

if (hosting.includes("firebase-tools@latest") || functions.includes("firebase-tools@latest")) {
  issues.push("workflows: pin firebase-tools to a known-good version instead of @latest");
}

for (const marker of [
  "name: Firebase Hosting Preview",
  "pull_request:",
  "group: firebase-hosting-preview-${{ github.event.pull_request.number }}",
  "github.event.pull_request.head.repo.full_name == github.repository",
  "node tools/qa-hosting-config.mjs",
  "node tools/qa-public-site.mjs",
  "node tools/qa-browser-flows.mjs",
  "actions/upload-artifact@v4",
  "name: firebase-hosting-preview",
  "retention-days: 7"
]) {
  if (!hostingPreview.includes(marker)) issues.push(`firebase-hosting-preview.yml: missing ${marker}`);
}

for (const marker of [
  "name: Firebase Hosting Preview Deploy",
  "workflow_run:",
  "Firebase Hosting Preview",
  "github.event.workflow_run.head_repository.full_name == github.repository",
  "ref: main",
  "google-github-actions/auth@v3",
  "actions/download-artifact@v5",
  "run-id: ${{ github.event.workflow_run.id }}",
  "test ! -e dist/data/lux-phase-status.json",
  "test ! -e dist/data/lux-action-inventory.json",
  "LUX_FIREBASE_HOSTING_CHANNEL=\"${CHANNEL_ID}\"",
  "node tools/deploy-firebase-hosting-rest.mjs",
  "GITHUB_STEP_SUMMARY"
]) {
  if (!hostingPreviewDeploy.includes(marker)) issues.push(`firebase-hosting-preview-deploy.yml: missing ${marker}`);
}

if (/secrets\.(?:GCP_|FIREBASE_)/.test(hostingPreview)) {
  issues.push("firebase-hosting-preview.yml: unprivileged PR build must not receive Firebase or Google Cloud secrets");
}

for (const marker of [
  "luxveritas.open_approval_decision_forms.v1",
  "decisionRecordTemplate",
  "Completed decision records belong in the approved private owner system",
  "Do not paste secrets",
  "LUX_APPROVAL_FORMS_FORMAT",
  "LUX_APPROVAL_FORMS_OUT"
]) {
  if (!openApprovalDecisionFormsExport.includes(marker)) issues.push(`export-open-approval-decision-forms.mjs: missing ${marker}`);
}

for (const marker of [
  "Open approval decision forms QA passed",
  "decisionRecordTemplate",
  "docs/open-approval-decision-forms.md",
  "privacy_review",
  "purchase_membership_terms",
  "secretShape"
]) {
  if (!openApprovalDecisionFormsQa.includes(marker)) issues.push(`qa-open-approval-decision-forms.mjs: missing ${marker}`);
}

for (const marker of [
  "Legal approval closeout QA passed",
  "Open approval decision form privacy_review YYYY-MM-DD",
  "Open approval decision form terms_review YYYY-MM-DD",
  "LUX_LEGAL_DRY_RUN",
  "LUX_LEGAL_SYNC_LAUNCH",
  "approvalIds",
  "publicTermsVersion",
  "secretPattern"
]) {
  if (!legalApprovalCloseoutQa.includes(marker)) issues.push(`qa-legal-approval-closeout.mjs: missing ${marker}`);
}

for (const marker of [
  "concurrency:",
  "group: firebase-functions",
  "timeout-minutes: 10",
  "timeout-minutes: 20",
  "Preflight Firebase deploy auth",
  "node tools/qa-firebase-deploy-auth.mjs",
  "workflow_dispatch:",
  "push:",
  '"functions/**"',
  '"firebase.json"',
  '".github/workflows/firebase-functions-manual.yml"',
  "npm --prefix functions ci",
  "npm --prefix functions run lint",
  "node tools/qa-integrations.mjs",
  "node tools/qa-integration-contract.mjs",
  "if: github.event_name == 'workflow_dispatch'",
  "needs: validate-functions",
  "deploy --only functions",
  "npx firebase-tools@15.22.1 deploy --only functions",
  "FIREBASE_CI_TOKEN: ${{ secrets.FIREBASE_CI_TOKEN }}",
  "--token \"$FIREBASE_CI_TOKEN\"",
  "npx firebase-tools@15.22.1 deploy --only functions --project lux-veritas-media --non-interactive --force",
  "submitform --region us-central1 --project lux-veritas-media --no-invoker-iam-check",
  "tracksiteevent --region us-central1 --project lux-veritas-media --no-invoker-iam-check",
  "reportactivity --region us-central1 --project lux-veritas-media --no-invoker-iam-check",
  "receiveprivatehandoff --region us-central1 --project lux-veritas-media --no-invoker-iam-check"
]) {
  if (!functions.includes(marker)) issues.push(`firebase-functions-manual.yml: missing ${marker}`);
}

for (const marker of [
  "firebase-tools@15.22.1",
  "hosting:sites:list",
  "FIREBASE_CI_TOKEN",
  "LUX_FIREBASE_DEPLOY_AUTH_DRY_RUN",
  "firebase login:ci",
  "Google Workload Identity / ADC",
  "Firebase Hosting REST auth fallback",
  "googleAccessToken"
]) {
  if (!firebaseDeployAuth.includes(marker)) issues.push(`qa-firebase-deploy-auth.mjs: missing ${marker}`);
}

for (const marker of [
  "firebasehosting.googleapis.com/v1beta1",
  "uploadRequiredHashes",
  "populateFiles",
  "updateMask=status",
  "LUX_FIREBASE_HOSTING_CHANNEL",
  "ensurePreviewChannel",
  "channels/${encodeURIComponent(channel)}/releases",
  "Firebase Hosting preview URL:",
  "googleAccessToken",
  "LUX_FIREBASE_HOSTING_REST_DRY_RUN"
]) {
  if (!firebaseRestDeploy.includes(marker)) issues.push(`deploy-firebase-hosting-rest.mjs: missing ${marker}`);
}

for (const marker of [
  "external_account",
  "service_account",
  "sts.googleapis.com/v1/token",
  "service_account_impersonation_url",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "firebase.hosting"
]) {
  if (!googleCloudAuth.includes(marker)) issues.push(`google-cloud-auth.mjs: missing ${marker}`);
}

for (const marker of [
  "FIREBASE_CI_TOKEN",
  "secret set",
  "--app",
  "actions",
  "qa-firebase-deploy-auth.mjs",
  "firebase-hosting-live.yml",
  "LUX_FIREBASE_CI_SETUP_DRY_RUN",
  "LUX_FIREBASE_CI_SETUP_SKIP_WORKFLOW",
  "LUX_FIREBASE_CI_SETUP_WATCH"
]) {
  if (!firebaseCiTokenSetup.includes(marker)) issues.push(`setup-firebase-ci-token.mjs: missing ${marker}`);
}

if (functions.includes('invoker: "public"') || functions.includes("invoker: 'public'")) {
  issues.push("firebase-functions-manual.yml: must not re-add public invoker config");
}

for (const marker of [
  "name: Final Release Audit",
  "workflow_dispatch:",
  "group: final-release-audit",
  "timeout-minutes: 20",
  "node tools/build-static.mjs",
  "node tools/prepare-hosting.mjs",
  "node tools/qa-release-handoff.mjs",
  "node tools/qa-action-inventory.mjs",
  "node tools/qa-launch-closeout.mjs",
  "node tools/qa-legal-sync.mjs",
  "node tools/qa-legal-approval-closeout.mjs",
  "node tools/qa-launch-blockers.mjs",
  "node tools/qa-open-approvals.mjs",
  "node tools/qa-open-approval-decision-forms.mjs",
  "node tools/qa-mvp-status.mjs",
  "node tools/qa-launch-evidence.mjs",
  "node tools/qa-pilot-write-evidence.mjs",
  "node tools/qa-pilot-bug-register.mjs",
  "node tools/qa-live-media-sources.mjs",
  "node tools/qa-resend-inbox-activation-terminal.mjs",
  "node tools/qa-private-integration-field-map.mjs",
  "node tools/qa-private-workflow-matrix.mjs",
  "node tools/qa-external-workflow-targets.mjs",
  "node tools/qa-private-workflow-selection.mjs",
  "node tools/qa-private-integration-request.mjs",
  "node tools/qa-private-workflow-approval-closeout.mjs",
  "node tools/qa-workflows.mjs",
  "LUX_FINAL_ALLOW_BLOCKERS=1 LUX_FINAL_SKIP_BROWSER=1 LUX_FINAL_SKIP_LIVE=1 node tools/qa-final-release-gate.mjs"
]) {
  if (!finalAudit.includes(marker)) issues.push(`final-release-audit.yml: missing ${marker}`);
}

if (finalAudit.includes("LUX_FINAL_WRITE_TESTS=1")) {
  issues.push("final-release-audit.yml: manual audit must not run write tests");
}

for (const marker of [
  "lux-build-manifest.json",
  "actions/workflows",
  "origin/main",
  "LUX_DEPLOY_STATUS_STRICT",
  "LUX_DEPLOY_ACTIVE_MAX_MINUTES",
  "minutesSince"
]) {
  if (!deployStatus.includes(marker)) issues.push(`qa-deploy-status.mjs: missing ${marker}`);
}

for (const marker of [
  "firebase-functions-manual.yml",
  "workflow_dispatch",
  "iam.serviceAccounts.ActAs",
  "lux-veritas-media@appspot.gserviceaccount.com",
  "GCP_SERVICE_ACCOUNT",
  "functions:list",
  "gh",
  "LUX_FUNCTIONS_DEPLOY_STRICT"
]) {
  if (!functionsDeployReadiness.includes(marker)) issues.push(`qa-functions-deploy-readiness.mjs: missing ${marker}`);
}

for (const marker of [
  "luxveritas.functions_iam_repair_request.v1",
  "GCP_SERVICE_ACCOUNT",
  "GCP_WORKLOAD_IDENTITY_PROVIDER",
  "iam.serviceAccounts.ActAs",
  "roles/iam.serviceAccountUser",
  "lux-veritas-media@appspot.gserviceaccount.com",
  "github-actions-firebase@lux-veritas-media.iam.gserviceaccount.com",
  "identified_pending_explicit_project_owner_approval",
  "Exact Approval Language",
  "node tools/qa-functions-deploy-readiness.mjs"
]) {
  if (!functionsIamRepairRequest.includes(marker) && !functionsIamRepairExport.includes(marker)) {
    issues.push(`Functions IAM repair tooling missing ${marker}`);
  }
}

for (const marker of [
  "luxveritas.open_approvals_report.v1",
  "LUX_OPEN_APPROVALS_JSON",
  "external_approvals_pending",
  "privacy_review",
  "terms_review",
  "functions_deploy_iam",
  "external_workflow_target",
  "seed_binder_private_upload",
  "blocksPublicLaunch",
  "node tools/qa-release-readiness.mjs",
  "node tools/qa-functions-deploy-readiness.mjs",
  "node tools/qa-private-workflow-selection.mjs"
]) {
  if (!openApprovals.includes(marker) && !openApprovalsQa.includes(marker)) {
    issues.push(`open approvals tooling missing ${marker}`);
  }
}

for (const marker of [
  "LUX_RESEND_API_KEY",
  "LUX_INBOX_ACTIVATION_DRY_RUN",
  "LUX_INBOX_ACTIVATION_SKIP_DOMAIN_CHECK",
  "LUX_INBOX_ACTIVATION_WRITE_TEST",
  "tools/qa-resend-domain-readiness.mjs",
  "tools/setup-inbox-provider-secret.mjs",
  "functions:submitForm,functions:reportActivity",
  "tools/qa-provider-readiness.mjs",
  "tools/qa-form-delivery.mjs"
]) {
  if (!inboxActivation.includes(marker)) issues.push(`activate-inbox-delivery.mjs: missing ${marker}`);
}

for (const marker of [
  "LUX_RESEND_API_KEY",
  "LUX_RESEND_DOMAIN",
  "LUX_RESEND_FROM_EMAIL",
  "LUX_RESEND_DOMAIN_STRICT",
  "https://api.resend.com",
  "forms@luxveritas.media",
  "luxveritas.media",
  "sending-ready"
]) {
  if (!resendDomainReadiness.includes(marker)) issues.push(`qa-resend-domain-readiness.mjs: missing ${marker}`);
}

for (const marker of [
  "readHidden",
  "setEcho(false)",
  "Paste approved Resend API key (input hidden):",
  "LUX_INBOX_ACTIVATION_LOG",
  "--dry-run",
  "--write-test",
  "--skip-deploy",
  "tools/qa-resend-domain-readiness.mjs",
  "tools/activate-inbox-delivery.mjs",
  "tools/qa-provider-readiness.mjs",
  "tools/qa-release-readiness.mjs"
]) {
  if (!resendActivationTerminal.includes(marker)) issues.push(`run-resend-inbox-activation-terminal.mjs: missing ${marker}`);
}

for (const marker of [
  "Resend inbox activation terminal QA passed",
  "node tools/run-resend-inbox-activation-terminal.mjs",
  "LUX_INBOX_ACTIVATION_LOG",
  "--dry-run",
  "--write-test",
  "--skip-deploy",
  "hidden input",
  "secretPattern"
]) {
  if (!resendActivationTerminalQa.includes(marker)) issues.push(`qa-resend-inbox-activation-terminal.mjs: missing ${marker}`);
}

for (const marker of [
  "LUX_FORM_INTEGRATION_URL",
  "LUX_FORM_INTEGRATION_SIGNING_SECRET",
  "LUX_FORM_INTEGRATION_TARGET",
  "LUX_PRIVATE_INTEGRATION_ALLOW_FUTURE",
  "LUX_PRIVATE_INTEGRATION_ACTIVATION_DRY_RUN",
  "docs/private-integration-profiles.json",
  "functions:submitForm,functions:reportActivity,functions:receivePrivateHandoff",
  "tools/qa-provider-readiness.mjs"
]) {
  if (!privateIntegrationActivation.includes(marker)) issues.push(`activate-private-integration.mjs: missing ${marker}`);
}

for (const marker of [
  "Private workflow approval closeout QA passed",
  "google_workspace approval flag guard",
  "google_workspace approved dry-run closeout",
  "LUX_PRIVATE_INTEGRATION_ALLOW_FUTURE",
  "LUX_PRIVATE_INTEGRATION_ACTIVATION_DRY_RUN",
  "FORM_INTEGRATION_TARGET to firebase_handoff",
  "recommendedTarget",
  "publicTermsVersion",
  "secretPattern"
]) {
  if (!privateWorkflowApprovalCloseout.includes(marker)) issues.push(`qa-private-workflow-approval-closeout.mjs: missing ${marker}`);
}

for (const marker of [
  "LUX_WWW_CLOSEOUT_WRITE",
  "LUX_WWW_CLOSEOUT_DRY_RUN",
  "LUX_WWW_CLOSEOUT_BY",
  "LUX_WWW_CLOSEOUT_EVIDENCE",
  "data/lux-launch-readiness.json",
  "data/lux-launch-closeout.json",
  "www_redirect"
]) {
  if (!wwwResolver.includes(marker)) issues.push(`resolve-www-domain.mjs: missing ${marker}`);
}

for (const marker of [
  "node tools/activate-inbox-delivery.mjs",
  "node tools/setup-firebase-ci-token.mjs",
  "node tools/resolve-www-domain.mjs",
  "node tools/qa-private-workflow-matrix.mjs",
  "node tools/qa-external-workflow-targets.mjs",
  "LUX_PILOT_WRITE_TESTS=1 node tools/qa-pilot-write-gate.mjs",
  "node tools/qa-pilot-bug-register.mjs",
  "reconciles the exact write-run IDs",
  "LUX_INBOX_ACTIVATION_WRITE_TEST=1",
  "ready to receive QA mail",
  "firebase login --reauth --no-localhost",
  "terminal prompt only"
]) {
  if (!finalLaunchRunbook.includes(marker)) issues.push(`final-launch-runbook.md: missing ${marker}`);
}

if (issues.length) {
  console.error(`Workflow QA failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log("Workflow QA passed.");
