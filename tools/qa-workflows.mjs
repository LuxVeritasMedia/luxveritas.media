import { readFile } from "node:fs/promises";

const issues = [];
const hosting = await readFile(".github/workflows/firebase-hosting-live.yml", "utf8");
const functions = await readFile(".github/workflows/firebase-functions-manual.yml", "utf8");
const finalAudit = await readFile(".github/workflows/final-release-audit.yml", "utf8");
const deployStatus = await readFile("tools/qa-deploy-status.mjs", "utf8");
const inboxActivation = await readFile("tools/activate-inbox-delivery.mjs", "utf8");
const privateIntegrationActivation = await readFile("tools/activate-private-integration.mjs", "utf8");
const wwwResolver = await readFile("tools/resolve-www-domain.mjs", "utf8");
const finalLaunchRunbook = await readFile("docs/final-launch-runbook.md", "utf8");

for (const marker of [
  "concurrency:",
  "group: firebase-hosting-live",
  "timeout-minutes: 20",
  "node tools/qa-buttons.mjs",
  "node tools/qa-public-site.mjs",
  "node tools/qa-access-model.mjs",
  "node tools/qa-integrations.mjs",
  "node tools/qa-integration-contract.mjs",
  "node tools/qa-integration-profiles.mjs",
  "node tools/qa-private-integration-field-map.mjs",
  "node tools/qa-private-workflow-matrix.mjs",
  "node tools/qa-private-integration-request.mjs",
  "node tools/qa-release-handoff.mjs",
  "node tools/qa-launch-closeout.mjs",
  "node tools/qa-launch-blockers.mjs",
  "node tools/qa-mvp-status.mjs",
  "node tools/qa-launch-evidence.mjs",
  "node tools/qa-media-contract.mjs",
  "node tools/qa-fan-signal.mjs",
  "node tools/qa-mobile-layout.mjs",
  "node tools/qa-accessibility.mjs",
  "node tools/qa-hosting-config.mjs",
  "node tools/qa-release-readiness.mjs",
  "node tools/qa-domain-readiness.mjs",
  "node tools/qa-provider-readiness.mjs",
  "npm install --no-save playwright",
  "npx playwright install chromium",
  "node tools/qa-browser-flows.mjs",
  "node tools/qa-live-site.mjs",
  "node tools/qa-live-assets.mjs",
  "node tools/qa-live-form-matrix.mjs",
  "node tools/qa-live-event-matrix.mjs",
  "node tools/qa-live-product-boundary.mjs",
  "node tools/qa-deploy-status.mjs",
  "LUX_BROWSER_BASE_URL=https://luxveritas.media node tools/qa-browser-flows.mjs"
]) {
  if (!hosting.includes(marker)) issues.push(`firebase-hosting-live.yml: missing ${marker}`);
}

for (const marker of [
  "concurrency:",
  "group: firebase-functions",
  "timeout-minutes: 10",
  "timeout-minutes: 20",
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
  "submitform --region us-central1 --project lux-veritas-media --no-invoker-iam-check",
  "tracksiteevent --region us-central1 --project lux-veritas-media --no-invoker-iam-check",
  "reportactivity --region us-central1 --project lux-veritas-media --no-invoker-iam-check",
  "receiveprivatehandoff --region us-central1 --project lux-veritas-media --no-invoker-iam-check"
]) {
  if (!functions.includes(marker)) issues.push(`firebase-functions-manual.yml: missing ${marker}`);
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
  "node tools/qa-launch-closeout.mjs",
  "node tools/qa-launch-blockers.mjs",
  "node tools/qa-mvp-status.mjs",
  "node tools/qa-launch-evidence.mjs",
  "node tools/qa-private-integration-field-map.mjs",
  "node tools/qa-private-workflow-matrix.mjs",
  "node tools/qa-private-integration-request.mjs",
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
  "LUX_RESEND_API_KEY",
  "LUX_INBOX_ACTIVATION_DRY_RUN",
  "LUX_INBOX_ACTIVATION_WRITE_TEST",
  "tools/setup-inbox-provider-secret.mjs",
  "functions:submitForm,functions:reportActivity",
  "tools/qa-provider-readiness.mjs",
  "tools/qa-form-delivery.mjs"
]) {
  if (!inboxActivation.includes(marker)) issues.push(`activate-inbox-delivery.mjs: missing ${marker}`);
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
  "node tools/resolve-www-domain.mjs",
  "node tools/qa-private-workflow-matrix.mjs",
  "LUX_INBOX_ACTIVATION_WRITE_TEST=1",
  "ready to receive QA mail"
]) {
  if (!finalLaunchRunbook.includes(marker)) issues.push(`final-launch-runbook.md: missing ${marker}`);
}

if (issues.length) {
  console.error(`Workflow QA failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log("Workflow QA passed.");
