import { readFile } from "node:fs/promises";

const issues = [];
const warnings = [];
const packetPath = "data/cr8-app-release-readiness.json";
const docPath = "docs/cr8-app-release-readiness-audit.md";
const storeDocPath = "docs/cr8-store-submission.md";

function issue(message) {
  issues.push(message);
}

function warning(message) {
  warnings.push(message);
}

const packet = JSON.parse(await readFile(packetPath, "utf8"));
const doc = await readFile(docPath, "utf8");
const storeDoc = await readFile(storeDocPath, "utf8");

if (packet.schemaVersion !== "luxveritas.cr8_app_release_readiness.v1") {
  issue(`${packetPath}: missing schemaVersion luxveritas.cr8_app_release_readiness.v1`);
}
if (packet.status !== "release_readiness_handoff") {
  issue(`${packetPath}: status must remain release_readiness_handoff until the app repo is audited`);
}
if (!packet.confidence?.includes("until_app_repo_audited")) {
  issue(`${packetPath}: confidence must state app repo audit dependency`);
}
if (packet.project?.appId !== "cr8" || packet.project?.appName !== "CR8") {
  issue(`${packetPath}: expected CR8 project identity`);
}
if (packet.currentPhase?.websiteEcosystemPhase !== 5) {
  issue(`${packetPath}: website ecosystem phase should remain 5 for current public work`);
}
if (packet.currentPhase?.cr8AppReleasePhase !== 2) {
  issue(`${packetPath}: CR8 app release phase should remain 2 until scope and app audit evidence exists`);
}

const websitePhases = packet.websitePhaseMap || [];
const appPhases = packet.cr8AppPhaseMap || [];
if (websitePhases.length !== 10) {
  issue(`${packetPath}: expected 10 website phases`);
}
if (appPhases.length !== 8) {
  issue(`${packetPath}: expected 8 CR8 app release phases`);
}
if (!appPhases.find((phase) => phase.phase === 1 && phase.status === "complete")) {
  issue(`${packetPath}: CR8 phase 1 should be complete for the public sales layer`);
}
for (const phase of appPhases.filter((item) => item.phase >= 3 && item.phase <= 7)) {
  if (phase.status === "complete") {
    issue(`${packetPath}: CR8 app phase ${phase.phase} must not be complete without app-build evidence`);
  }
}

const progression = packet.progression || {};
if ((progression.cr8AppRelease?.percentCompleteFromWebsiteEvidence || 0) > 30) {
  issue(`${packetPath}: CR8 app release percentage from website evidence should stay conservative before app audit`);
}
if ((progression.luxveritasWebsite?.percentComplete || 0) < 60) {
  warning(`${packetPath}: website percentage is unexpectedly low after deployed public/app-market work`);
}

const qualityGates = packet.qualityGates || [];
for (const gateId of ["website_sales_layer", "store_metadata", "real_screenshots", "app_build_audit", "store_submission"]) {
  if (!qualityGates.some((gate) => gate.id === gateId)) {
    issue(`${packetPath}: missing quality gate ${gateId}`);
  }
}
if (qualityGates.some((gate) => gate.id === "real_screenshots" && gate.status !== "blocked_until_app_build")) {
  issue(`${packetPath}: real screenshots must remain blocked until actual app build capture`);
}
if (qualityGates.some((gate) => gate.id === "store_submission" && gate.status === "passed")) {
  issue(`${packetPath}: store submission must not be marked passed before store-console evidence exists`);
}

if (!packet.handoffPrompt?.includes("Do not mark real screenshots")) {
  issue(`${packetPath}: handoff prompt must include screenshot/approval guardrail`);
}
if (!packet.northStar?.includes("calm, premium creator app")) {
  issue(`${packetPath}: north star must preserve CR8 positioning`);
}

for (const required of [
  "CR8 App Release Readiness Audit",
  "North Star",
  "Current Percentages",
  "Website Phase Map",
  "CR8 App Phase Map",
  "Exact Prompt For The CR8 App Build Conversation",
  "Do not confuse a beautiful product page with a submitted app."
]) {
  if (!doc.includes(required)) {
    issue(`${docPath}: missing section or guardrail: ${required}`);
  }
}
if (!storeDoc.includes("Release audit: `docs/cr8-app-release-readiness-audit.md`")) {
  issue(`${storeDocPath}: missing release audit cross-link`);
}

if (issues.length) {
  console.error("CR8 app release readiness QA failed:");
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`CR8 app release readiness QA passed with ${warnings.length} warning(s).`);
for (const item of warnings) console.warn(`Warning: ${item}`);
