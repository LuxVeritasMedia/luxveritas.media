import { readFile, writeFile } from "node:fs/promises";

const file = "data/lux-launch-readiness.json";
const gateArg = (process.env.LUX_LAUNCH_GATE || "").trim().toLowerCase();
const statusArg = (process.env.LUX_LAUNCH_STATUS || "").trim().toLowerCase();
const updatedBy = (process.env.LUX_LAUNCH_BY || "").trim();
const evidenceReference = (process.env.LUX_LAUNCH_EVIDENCE || "").trim();
const dryRun = process.env.LUX_LAUNCH_DRY_RUN === "1";
const validStatuses = new Set(["ready", "blocked"]);
const secretPattern = /re_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|REPORT_OPERATOR_TOKEN=.*[A-Za-z0-9_-]{12,}|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}|[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/;

function fail(message) {
  console.error(message);
  console.error("");
  console.error("Usage:");
  console.error("  LUX_LAUNCH_GATE=www_redirect LUX_LAUNCH_STATUS=ready LUX_LAUNCH_BY='Reviewer Name' LUX_LAUNCH_EVIDENCE='Domain readiness QA 2026-06-16' node tools/set-launch-readiness-status.mjs");
  console.error("  LUX_LAUNCH_GATE=inbox_notifications LUX_LAUNCH_STATUS=blocked LUX_LAUNCH_EVIDENCE='Sender domain still pending provider verification' node tools/set-launch-readiness-status.mjs");
  console.error("");
  console.error("Use LUX_LAUNCH_DRY_RUN=1 to validate without writing.");
  process.exit(1);
}

if (!gateArg) fail("Set LUX_LAUNCH_GATE to one launch readiness gate id.");
if (!validStatuses.has(statusArg)) fail("Set LUX_LAUNCH_STATUS to ready or blocked.");
if (statusArg === "ready" && !updatedBy) fail("Set LUX_LAUNCH_BY before marking a launch gate ready.");
if (statusArg === "ready" && !evidenceReference) fail("Set LUX_LAUNCH_EVIDENCE before marking a launch gate ready.");
if (evidenceReference && secretPattern.test(evidenceReference)) fail("LUX_LAUNCH_EVIDENCE appears to contain secret-shaped data. Store only a no-secret evidence reference.");

const manifest = JSON.parse(await readFile(file, "utf8"));
if (!manifest.version && manifest.schemaVersion !== "luxveritas.launch_readiness.v1") {
  fail("Unexpected launch readiness manifest: missing version.");
}

const now = new Date().toISOString();
let found = false;
const next = {
  ...manifest,
  updatedAt: now,
  gates: manifest.gates.map((gate) => {
    if (gate.id !== gateArg) return gate;
    found = true;
    return {
      ...gate,
      status: statusArg,
      statusEvidenceReference: evidenceReference,
      statusUpdatedAt: now,
      statusUpdatedBy: updatedBy
    };
  })
};

if (!found) fail(`Launch readiness manifest is missing gate: ${gateArg}`);

if (dryRun) {
  console.log(`Dry run passed for ${gateArg} -> ${statusArg}.`);
  process.exit(0);
}

await writeFile(file, `${JSON.stringify(next, null, 2)}\n`);
console.log(`Updated ${file}: ${gateArg} -> ${statusArg}.`);
console.log("Reminder: keep TODO.md, docs/production-release-handoff.md, docs/final-launch-runbook.md, and data/lux-launch-closeout.json synchronized before final QA.");
