import { readFile } from "node:fs/promises";

const issues = [];
const functionJs = await readFile("functions/index.js", "utf8");
const contractJs = await readFile("functions/integration-contract.js", "utf8");
const appJs = await readFile("app.js", "utf8");
const buildScript = await readFile("tools/build-static.mjs", "utf8");
const docs = await readFile("docs/deployment.md", "utf8");
const profileRegistry = await readFile("docs/private-integration-profiles.json", "utf8");
const fieldMap = await readFile("docs/private-integration-field-map.json", "utf8");
const workflowMatrix = await readFile("docs/private-workflow-matrix.json", "utf8");
const externalWorkflowTargets = await readFile("docs/external-workflow-targets.json", "utf8");

for (const marker of [
  "FORM_INTEGRATION_URL",
  "FORM_INTEGRATION_SIGNING_SECRET",
  "FORM_INTEGRATION_TARGET",
  "formIntegrationUrl",
  "formIntegrationSigningSecret",
  "formIntegrationTarget",
  "RESEND_API_KEY",
  "resendApiKey",
  "REPORT_OPERATOR_TOKEN_SHA256",
  "operatorTokenConfigured",
  "operator_token",
  "safeEqualHex",
  "sendIntegration",
  "receivePrivateHandoff",
  "private_handoffs",
  "validatePrivateHandoff",
  "verifyIntegrationSignature",
  "X-Lux-Signature",
  "integrationPayload",
  "buildIntegrationPayload",
  "integrationBaseHeaders",
  "normalizeIntegrationTarget",
  "integrationStatus",
  "byIntegrationStatus",
  "integrationWebhook",
  "integrationTarget",
  "integrationTargetConfigured",
  "replayPendingInbox",
  "replayPendingIntegration",
  "testInboxDelivery",
  "replay_pending",
  "replay_integration",
  "test_inbox",
  "pendingNotificationCount",
  "pendingIntegrationCount",
  "pendingNotifications",
  "pendingIntegrations",
  "privateHandoffs",
  "cleanHandoffDoc",
  "summarizeHandoffs",
  "routing_queue",
  "routing_next_action",
  "public_terms_version",
  "privacy_version",
  "terms_version",
  "submission_terms_version",
  "buildPilotFunnel",
  "https:\\/\\/"
]) {
  if (!functionJs.includes(marker)) issues.push(`functions/index.js: missing integration marker ${marker}`);
}

for (const marker of [
  "buildIntegrationPayload",
  "integrationBaseHeaders",
  "integrationContractVersion",
  "integrationEventType",
  "defaultIntegrationTarget",
  "normalizeIntegrationTarget",
  "integrationIdempotencyKey",
  "integrationSignature",
  "verifyIntegrationSignature",
  "luxveritas.form_submission.v1",
  "form.submission.received",
  "idempotencyKey",
  "replaySafe",
  "integrationTarget",
  "receiver: {",
  "routing: {",
  "legal: {",
  "publicTermsVersion",
  "privacyVersion",
  "termsVersion",
  "submissionTermsVersion",
  "X-Lux-Event",
  "X-Lux-Idempotency-Key",
  "X-Lux-Target"
]) {
  if (!contractJs.includes(marker)) issues.push(`functions/integration-contract.js: missing contract marker ${marker}`);
}

for (const marker of [
  "data-private-summary=\"integrations\"",
  "data-report-action=\"replay-private\"",
  "data-report-action=\"replay-integration\"",
  "data-report-action=\"test-inbox\"",
  "data-private-count=\"pendingNotifications\"",
  "data-private-count=\"pendingIntegrations\"",
  "data-private-count=\"privateHandoffs\"",
  "data-private-delivery=\"target\"",
  "data-private-delivery=\"targetDetail\"",
  "data-private-auth=\"mode\"",
  "data-private-auth=\"viewer\"",
  "data-private-funnel",
  "data-launch-readiness-summary",
  "data-private-summary=\"routing\"",
  "data-private-summary=\"delivery\"",
  "data-private-summary=\"handoffs\"",
  "data-private-summary=\"ctas\"",
  "Integrations"
]) {
  if (!buildScript.includes(marker)) issues.push(`tools/build-static.mjs: missing private integration summary marker ${marker}`);
}

for (const marker of [
  "byIntegrationStatus",
  "byRoutingQueue",
  "byCtaId",
  "byCtaLabel",
  "renderLaunchReadinessReport",
  "renderPrivateSummary(panel, \"routing\"",
  "renderPrivateSummary(panel, \"delivery\"",
  "renderPrivateSummary(panel, \"ctas\"",
  "renderPrivateSummary(panel, \"integrations\"",
  "renderPrivateSummary(panel, \"handoffs\"",
  "type: \"handoff\"",
  "privateReportRows",
  "renderPrivateFunnel",
  "integrationTargetConfigured",
  "operatorTokenConfigured",
  "data-private-delivery=\"target\"",
  "data-private-auth=\"mode\"",
  "replayPendingNotifications",
  "replayPendingIntegration",
  "testInboxDelivery"
]) {
  if (!appJs.includes(marker)) issues.push(`app.js: missing private integration rendering marker ${marker}`);
}

for (const marker of [
  "FORM_INTEGRATION_URL",
  "FORM_INTEGRATION_SIGNING_SECRET",
  "FORM_INTEGRATION_TARGET",
  "REPORT_OPERATOR_TOKEN_SHA256",
  "activate-inbox-delivery",
  "activate-private-integration",
  "setup-private-integration-secret",
  "luxveritas.form_submission.v1",
  "X-Lux-Target",
  "idempotency",
  "replay_pending",
  "replay_integration",
  "Screened Intake Routing",
  "server-side integration",
  "receivePrivateHandoff",
  "private_handoffs",
  "X-Lux-Signature"
]) {
  if (!docs.includes(marker)) issues.push(`docs/deployment.md: missing integration setup marker ${marker}`);
}

for (const marker of [
  "luxveritas.private_integration_profiles.v1",
  "firebase_handoff",
  "private_workflow",
  "ghl_crm",
  "google_workspace",
  "codex_ops",
  "luxveritas.form_submission.v1",
  "FORM_INTEGRATION_TARGET",
  "publicExposure"
]) {
  if (!profileRegistry.includes(marker)) issues.push(`private-integration-profiles.json: missing profile marker ${marker}`);
}

for (const marker of [
  "luxveritas.private_integration_field_map.v1",
  "luxveritas.form_submission.v1",
  "form.submission.received",
  "requiredPayloadPaths",
  "firebase_handoff",
  "private_workflow",
  "ghl_crm",
  "google_workspace",
  "codex_ops",
  "contact.email",
  "routing.queue",
  "legal.publicTermsVersion",
  "support_replay"
]) {
  if (!fieldMap.includes(marker)) issues.push(`private-integration-field-map.json: missing field-map marker ${marker}`);
}

for (const marker of [
  "luxveritas.private_workflow_matrix.v1",
  "membership_waitlist",
  "submission_review",
  "event_access",
  "press_contact",
  "partner_licensing",
  "strategic_access",
  "access_review",
  "firebase_handoff",
  "ghl_crm",
  "google_workspace",
  "codex_ops",
  "publicExposure"
]) {
  if (!workflowMatrix.includes(marker)) issues.push(`private-workflow-matrix.json: missing workflow marker ${marker}`);
}

for (const marker of [
  "luxveritas.external_workflow_targets.v1",
  "firebase_handoff",
  "ghl_crm",
  "google_workspace",
  "codex_ops",
  "membership_waitlist",
  "submission_review",
  "LUX_PRIVATE_INTEGRATION_ALLOW_FUTURE=1",
  "publicExposure"
]) {
  if (!externalWorkflowTargets.includes(marker)) issues.push(`external-workflow-targets.json: missing workflow target marker ${marker}`);
}

if (/https?:\/\//i.test(profileRegistry)) {
  issues.push("private-integration-profiles.json: must not contain provider URLs");
}
if (/https?:\/\//i.test(fieldMap)) {
  issues.push("private-integration-field-map.json: must not contain provider URLs");
}
if (/https?:\/\//i.test(workflowMatrix)) {
  issues.push("private-workflow-matrix.json: must not contain provider URLs");
}
if (/https?:\/\//i.test(externalWorkflowTargets)) {
  issues.push("external-workflow-targets.json: must not contain provider URLs");
}

if (/FORM_INTEGRATION_URL\s*=|https:\/\/hooks\.|webhookUrl/i.test(appJs)) {
  issues.push("app.js: public client must not expose integration URLs");
}

if (issues.length) {
  console.error(`Integration QA failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log("Integration QA passed.");
