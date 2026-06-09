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
  "integrationStatus",
  "byIntegrationStatus",
  "integrationWebhook",
  "https:\\/\\/"
]) {
  if (!functionJs.includes(marker)) issues.push(`functions/index.js: missing integration marker ${marker}`);
}

for (const marker of [
  "data-private-summary=\"integrations\"",
  "Integrations"
]) {
  if (!buildScript.includes(marker)) issues.push(`tools/build-static.mjs: missing private integration summary marker ${marker}`);
}

for (const marker of [
  "byIntegrationStatus",
  "renderPrivateSummary(panel, \"integrations\""
]) {
  if (!appJs.includes(marker)) issues.push(`app.js: missing private integration rendering marker ${marker}`);
}

for (const marker of [
  "FORM_INTEGRATION_URL",
  "FORM_INTEGRATION_SIGNING_SECRET",
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
