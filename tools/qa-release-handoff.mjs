import { readFile } from "node:fs/promises";

const issues = [];
const handoff = await readFile("docs/production-release-handoff.md", "utf8");
const todo = await readFile("TODO.md", "utf8");
const buildManifest = JSON.parse(await readFile("data/lux-build-manifest.json", "utf8"));

function issue(message) {
  issues.push(message);
}

for (const marker of [
  "https://luxveritas.media",
  "lux-veritas-media",
  "LuxVeritasMedia/luxveritas.media",
  buildManifest.assetVersion,
  "www.luxveritas.media",
  "firebase login --reauth",
  "RESEND_API_KEY",
  "forms@luxveritas.media",
  "Privacy page needs legal/business approval",
  "Terms page needs legal/business approval",
  "External CRM/Google workflow target",
  "node tools/qa-provider-readiness.mjs",
  "node tools/qa-domain-readiness.mjs",
  "node tools/qa-release-readiness.mjs",
  "LUX_PILOT_BROWSER=1 LUX_PILOT_LIVE=1 node tools/qa-pilot-readiness.mjs",
  "LUX_FORM_MATRIX_WRITE=1 LUX_EXPECT_EMAIL_SENT=1 node tools/qa-live-form-matrix.mjs"
]) {
  if (!handoff.includes(marker)) issue(`production-release-handoff.md missing marker: ${marker}`);
}

for (const marker of [
  "Configure www.luxveritas.media DNS and Hosting redirect",
  "Configure and verify email provider runtime secret `RESEND_API_KEY`",
  "Legal review: Privacy",
  "Legal review: Terms",
  "Configure approved external CRM/Google workflow target"
]) {
  if (!todo.includes(marker)) issue(`TODO.md missing launch blocker marker: ${marker}`);
}

if (/re_[A-Za-z0-9_-]{8,}/.test(handoff)) {
  issue("production-release-handoff.md appears to contain a real Resend key");
}

if (/REPORT_OPERATOR_TOKEN=|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}/.test(handoff)) {
  issue("production-release-handoff.md appears to contain a private report token");
}

if (issues.length) {
  console.error(`Release handoff QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log("Release handoff QA passed.");
