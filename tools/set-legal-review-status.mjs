import { readFile, writeFile } from "node:fs/promises";

const file = "data/lux-legal-review.json";
const launchFile = "data/lux-launch-readiness.json";
const closeoutFile = "data/lux-launch-closeout.json";
const itemArg = (process.env.LUX_LEGAL_REVIEW_ITEM || "").trim().toLowerCase();
const statusArg = (process.env.LUX_LEGAL_REVIEW_STATUS || "").trim().toLowerCase();
const reviewedBy = (process.env.LUX_LEGAL_REVIEWED_BY || "").trim();
const evidenceReference = (process.env.LUX_LEGAL_EVIDENCE || "").trim();
const syncLaunch = process.env.LUX_LEGAL_SYNC_LAUNCH === "1";
const dryRun = process.env.LUX_LEGAL_DRY_RUN === "1";
const confirmWrite = process.env.LUX_LEGAL_CONFIRM_WRITE === "1";
const validItems = new Set(["privacy", "terms", "all"]);
const validStatuses = new Set(["approved", "needs_review"]);
const gateByLegalItem = {
  privacy: "privacy_review",
  terms: "terms_review"
};
const secretPattern = /re_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|REPORT_OPERATOR_TOKEN=.*[A-Za-z0-9_-]{12,}|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}|[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/;

function fail(message) {
  console.error(message);
  console.error("");
  console.error("Usage:");
  console.error("  LUX_LEGAL_CONFIRM_WRITE=1 LUX_LEGAL_REVIEW_ITEM=privacy LUX_LEGAL_REVIEW_STATUS=approved LUX_LEGAL_REVIEWED_BY='Reviewer Name' node tools/set-legal-review-status.mjs");
  console.error("  LUX_LEGAL_CONFIRM_WRITE=1 LUX_LEGAL_SYNC_LAUNCH=1 LUX_LEGAL_EVIDENCE='Legal review packet 2026-06-20' LUX_LEGAL_REVIEW_ITEM=privacy LUX_LEGAL_REVIEW_STATUS=approved LUX_LEGAL_REVIEWED_BY='Reviewer Name' node tools/set-legal-review-status.mjs");
  console.error("  LUX_LEGAL_CONFIRM_WRITE=1 LUX_LEGAL_REVIEW_ITEM=all LUX_LEGAL_REVIEW_STATUS=needs_review node tools/set-legal-review-status.mjs");
  console.error("");
  console.error("Use LUX_LEGAL_DRY_RUN=1 to validate without writing.");
  process.exit(1);
}

if (!validItems.has(itemArg)) fail("Set LUX_LEGAL_REVIEW_ITEM to privacy, terms, or all.");
if (!validStatuses.has(statusArg)) fail("Set LUX_LEGAL_REVIEW_STATUS to approved or needs_review.");
if (statusArg === "approved" && !reviewedBy) fail("Set LUX_LEGAL_REVIEWED_BY before marking legal review approved.");
if (syncLaunch && statusArg === "approved" && !evidenceReference) fail("Set LUX_LEGAL_EVIDENCE before syncing approved legal review to launch closeout.");
if (evidenceReference && secretPattern.test(evidenceReference)) fail("LUX_LEGAL_EVIDENCE appears to contain secret-shaped data. Store only a no-secret evidence reference.");
if (!dryRun && !confirmWrite) fail("Set LUX_LEGAL_CONFIRM_WRITE=1 before writing legal review status. Use LUX_LEGAL_DRY_RUN=1 to validate without writing.");

const [manifestRaw, launchRaw, closeoutRaw] = await Promise.all([
  readFile(file, "utf8"),
  syncLaunch ? readFile(launchFile, "utf8") : Promise.resolve(null),
  syncLaunch ? readFile(closeoutFile, "utf8") : Promise.resolve(null)
]);
const manifest = JSON.parse(manifestRaw);
if (manifest.schemaVersion !== "luxveritas.legal_review.v1") {
  fail(`Unexpected legal review schemaVersion: ${manifest.schemaVersion || "missing"}`);
}
const launch = launchRaw ? JSON.parse(launchRaw) : null;
const closeout = closeoutRaw ? JSON.parse(closeoutRaw) : null;
if (syncLaunch && !launch?.gates) fail("Launch readiness manifest is missing gates.");
if (syncLaunch && closeout?.schemaVersion !== "luxveritas.launch_closeout.v1") {
  fail(`Unexpected launch closeout schemaVersion: ${closeout?.schemaVersion || "missing"}`);
}

const targets = itemArg === "all" ? ["privacy", "terms"] : [itemArg];
const now = new Date().toISOString();
const found = new Set();

const next = {
  ...manifest,
  updatedAt: now,
  items: manifest.items.map((item) => {
    if (!targets.includes(item.id)) return item;
    found.add(item.id);
    return {
      ...item,
      status: statusArg,
      reviewedAt: statusArg === "approved" ? now : null,
      reviewedBy: statusArg === "approved" ? reviewedBy : null
    };
  })
};

for (const target of targets) {
  if (!found.has(target)) fail(`Legal review manifest is missing item: ${target}`);
}

let nextLaunch = launch;
let nextCloseout = closeout;
if (syncLaunch) {
  const targetGates = targets.map((target) => gateByLegalItem[target]);
  const foundGates = new Set();
  nextLaunch = {
    ...launch,
    updatedAt: now,
    gates: launch.gates.map((gate) => {
      if (!targetGates.includes(gate.id)) return gate;
      foundGates.add(gate.id);
      return {
        ...gate,
        status: statusArg === "approved" ? "ready" : "blocked",
        statusEvidenceReference: statusArg === "approved" ? evidenceReference : "",
        statusUpdatedAt: now,
        statusUpdatedBy: statusArg === "approved" ? reviewedBy : ""
      };
    })
  };

  const foundCloseout = new Set();
  nextCloseout = {
    ...closeout,
    updatedAt: now,
    items: closeout.items.map((item) => {
      if (!targetGates.includes(item.id)) return item;
      foundCloseout.add(item.id);
      if (statusArg === "approved") {
        return {
          ...item,
          status: "closed",
          evidenceReference,
          closedAt: now,
          closedBy: reviewedBy
        };
      }
      return {
        ...item,
        status: "open",
        evidenceReference: "",
        closedAt: "",
        closedBy: ""
      };
    })
  };

  for (const gate of targetGates) {
    if (!foundGates.has(gate)) fail(`Launch readiness manifest is missing gate: ${gate}`);
    if (!foundCloseout.has(gate)) fail(`Launch closeout manifest is missing item: ${gate}`);
  }
}

if (dryRun) {
  console.log(`Dry run passed for ${targets.join(", ")} -> ${statusArg}${syncLaunch ? " with launch sync" : ""}.`);
  process.exit(0);
}

const writes = [writeFile(file, `${JSON.stringify(next, null, 2)}\n`)];
if (syncLaunch) {
  writes.push(writeFile(launchFile, `${JSON.stringify(nextLaunch, null, 2)}\n`));
  writes.push(writeFile(closeoutFile, `${JSON.stringify(nextCloseout, null, 2)}\n`));
}
await Promise.all(writes);
console.log(`Updated ${file}: ${targets.join(", ")} -> ${statusArg}.`);
if (syncLaunch) {
  console.log(`Synchronized ${launchFile} and ${closeoutFile} for ${targets.map((target) => gateByLegalItem[target]).join(", ")}.`);
}
