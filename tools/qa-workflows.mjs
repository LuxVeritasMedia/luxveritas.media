import { readFile } from "node:fs/promises";

const issues = [];
const hosting = await readFile(".github/workflows/firebase-hosting-live.yml", "utf8");
const functions = await readFile(".github/workflows/firebase-functions-manual.yml", "utf8");
const deployStatus = await readFile("tools/qa-deploy-status.mjs", "utf8");

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
  "node tools/qa-release-handoff.mjs",
  "node tools/qa-media-contract.mjs",
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
  "lux-build-manifest.json",
  "actions/workflows",
  "origin/main",
  "LUX_DEPLOY_STATUS_STRICT"
]) {
  if (!deployStatus.includes(marker)) issues.push(`qa-deploy-status.mjs: missing ${marker}`);
}

if (issues.length) {
  console.error(`Workflow QA failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log("Workflow QA passed.");
