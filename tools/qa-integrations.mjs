import { readFile } from "node:fs/promises";

const issues = [];
const functionJs = await readFile("functions/index.js", "utf8");
const appJs = await readFile("app.js", "utf8");
const buildScript = await readFile("tools/build-static.mjs", "utf8");
const docs = await readFile("docs/deployment.md", "utf8");

for (const marker of [
  "FORM_INTEGRATION_URL",
  "FORM_INTEGRATION_SIGNING_SECRET",
  "sendIntegration",
  "integrationPayload",
  "integrationContractVersion",
  "integrationEventType",
  "integrationIdempotencyKey",
  "integrationStatus",
  "byIntegrationStatus",
  "integrationWebhook",
  "replayPendingInbox",
  "replayPendingIntegration",
  "replay_pending",
  "replay_integration",
  "pendingNotificationCount",
  "pendingIntegrationCount",
  "pendingNotifications",
  "pendingIntegrations",
  "routing_queue",
  "routing_next_action",
  "routing: {",
  "schemaVersion",
  "idempotencyKey",
  "replaySafe",
  "X-Lux-Event",
  "X-Lux-Idempotency-Key",
  "buildPilotFunnel",
  "https:\\/\\/"
]) {
  if (!functionJs.includes(marker)) issues.push(`functions/index.js: missing integration marker ${marker}`);
}

for (const marker of [
  "data-private-summary=\"integrations\"",
  "data-report-action=\"replay-private\"",
  "data-report-action=\"replay-integration\"",
  "data-private-count=\"pendingNotifications\"",
  "data-private-count=\"pendingIntegrations\"",
  "data-private-funnel",
  "data-launch-readiness-summary",
  "data-private-summary=\"routing\"",
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
  "renderPrivateSummary(panel, \"ctas\"",
  "renderPrivateSummary(panel, \"integrations\"",
  "renderPrivateFunnel",
  "replayPendingNotifications",
  "replayPendingIntegration"
]) {
  if (!appJs.includes(marker)) issues.push(`app.js: missing private integration rendering marker ${marker}`);
}

for (const marker of [
  "FORM_INTEGRATION_URL",
  "FORM_INTEGRATION_SIGNING_SECRET",
  "luxveritas.form_submission.v1",
  "idempotency",
  "replay_pending",
  "replay_integration",
  "Screened Intake Routing",
  "server-side integration"
]) {
  if (!docs.includes(marker)) issues.push(`docs/deployment.md: missing integration setup marker ${marker}`);
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
