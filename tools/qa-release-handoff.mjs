import { readFile } from "node:fs/promises";

const issues = [];
const handoff = await readFile("docs/production-release-handoff.md", "utf8");
const blockerResolution = await readFile("docs/launch-blocker-resolution.md", "utf8");
const legalReviewPacket = await readFile("docs/legal-review-packet.md", "utf8");
const finalLaunchRunbook = await readFile("docs/final-launch-runbook.md", "utf8");
const todo = await readFile("TODO.md", "utf8");
const buildManifest = JSON.parse(await readFile("data/lux-build-manifest.json", "utf8"));
const finalGate = await readFile("tools/qa-final-release-gate.mjs", "utf8");

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
  "node tools/qa-final-release-gate.mjs",
  "node tools/qa-operator-environment.mjs",
  "node tools/report-mvp-status.mjs",
  "node tools/qa-mvp-preflight.mjs",
  "node tools/qa-launch-evidence.mjs",
  "LUX_FINAL_WRITE_TESTS=1 node tools/qa-final-release-gate.mjs",
  "Do not use `LUX_FINAL_SKIP_BROWSER=1` or `LUX_FINAL_SKIP_LIVE=1` for release approval.",
  "LUX_FORM_MATRIX_WRITE=1 LUX_EXPECT_EMAIL_SENT=1 node tools/qa-live-form-matrix.mjs"
]) {
  if (!handoff.includes(marker)) issue(`production-release-handoff.md missing marker: ${marker}`);
}

if (!handoff.includes("Use `docs/legal-review-packet.md` for Privacy and Terms review.")) {
  issue("production-release-handoff.md missing legal review packet pointer");
}
if (!handoff.includes("Use `docs/final-launch-runbook.md` for the exact final launch sequence.")) {
  issue("production-release-handoff.md missing final launch runbook pointer");
}

for (const marker of [
  "docs/launch-blocker-resolution.md",
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
  "node tools/qa-domain-readiness.mjs",
  "LUX_RESEND_API_KEY=\"re_...\" node tools/setup-inbox-provider-secret.mjs",
  "LUX_LEGAL_REVIEW_ITEM=privacy",
  "LUX_LEGAL_REVIEW_ITEM=terms",
  "LUX_PILOT_LIVE=1 LUX_PILOT_STRICT=1 node tools/qa-pilot-readiness.mjs",
  "LUX_FINAL_WRITE_TESTS=1 node tools/qa-final-release-gate.mjs"
]) {
  if (!blockerResolution.includes(marker)) {
    issue(`docs/launch-blocker-resolution.md missing marker: ${marker}`);
  }
}

for (const marker of [
  "/legal/privacy.html",
  "/legal/terms.html",
  "data/lux-legal-review.json",
  "data/lux-public-terms.json",
  "Privacy Checklist",
  "Terms Checklist",
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
  "node tools/qa-deploy-status.mjs",
  "node tools/qa-domain-readiness.mjs",
  "LUX_RESEND_API_KEY=\"re_...\" node tools/setup-inbox-provider-secret.mjs",
  "LUX_LEGAL_REVIEW_ITEM=privacy",
  "LUX_LEGAL_REVIEW_ITEM=terms",
  "LUX_FINAL_WRITE_TESTS=1 node tools/qa-final-release-gate.mjs",
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
  "MVP Preflight",
  "tools/qa-mvp-preflight.mjs",
  "Deploy Status",
  "Domain Readiness",
  "Provider Readiness",
  "Release Readiness",
  "Full Pilot Readiness",
  "Final Write Tests"
]) {
  if (!finalGate.includes(marker)) {
    issue(`tools/qa-final-release-gate.mjs missing marker: ${marker}`);
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
  "Configure www.luxveritas.media DNS and Hosting redirect",
  "Configure and verify email provider runtime secret `RESEND_API_KEY`",
  "Add legal review packet for Privacy and Terms approval",
  "Add final strict release-gate command for launch-day acceptance",
  "Require final release-gate write mode for launch-day approval",
  "Require browser and live coverage in final release-gate approval mode",
  "Add final launch runbook for DNS, inbox, legal, write tests, and gate approval",
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
