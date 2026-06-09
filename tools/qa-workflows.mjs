import { readFile } from "node:fs/promises";

const issues = [];
const hosting = await readFile(".github/workflows/firebase-hosting-live.yml", "utf8");
const functions = await readFile(".github/workflows/firebase-functions-manual.yml", "utf8");

for (const marker of [
  "node tools/qa-buttons.mjs",
  "node tools/qa-public-site.mjs",
  "node tools/qa-access-model.mjs",
  "node tools/qa-mobile-layout.mjs",
  "node tools/qa-live-site.mjs"
]) {
  if (!hosting.includes(marker)) issues.push(`firebase-hosting-live.yml: missing ${marker}`);
}

for (const marker of [
  "workflow_dispatch:",
  "push:",
  '"functions/**"',
  '"firebase.json"',
  '".github/workflows/firebase-functions-manual.yml"',
  "npm --prefix functions ci",
  "deploy --only functions",
  "submitform --region us-central1 --project lux-veritas-media --no-invoker-iam-check",
  "tracksiteevent --region us-central1 --project lux-veritas-media --no-invoker-iam-check",
  "reportactivity --region us-central1 --project lux-veritas-media --no-invoker-iam-check"
]) {
  if (!functions.includes(marker)) issues.push(`firebase-functions-manual.yml: missing ${marker}`);
}

if (functions.includes('invoker: "public"') || functions.includes("invoker: 'public'")) {
  issues.push("firebase-functions-manual.yml: must not re-add public invoker config");
}

if (issues.length) {
  console.error(`Workflow QA failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log("Workflow QA passed.");
