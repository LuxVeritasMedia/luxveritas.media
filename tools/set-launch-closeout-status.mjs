import { readFile, writeFile } from "node:fs/promises";

const file = "data/lux-launch-closeout.json";
const itemArg = (process.env.LUX_CLOSEOUT_ITEM || "").trim().toLowerCase();
const statusArg = (process.env.LUX_CLOSEOUT_STATUS || "").trim().toLowerCase();
const closedBy = (process.env.LUX_CLOSEOUT_BY || "").trim();
const evidenceReference = (process.env.LUX_CLOSEOUT_EVIDENCE || "").trim();
const dryRun = process.env.LUX_CLOSEOUT_DRY_RUN === "1";
const validStatuses = new Set(["open", "closed", "blocked"]);
const secretPattern = /re_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|REPORT_OPERATOR_TOKEN=.*[A-Za-z0-9_-]{12,}|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}|[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/;

function fail(message) {
  console.error(message);
  console.error("");
  console.error("Usage:");
  console.error("  LUX_CLOSEOUT_ITEM=www_redirect LUX_CLOSEOUT_STATUS=closed LUX_CLOSEOUT_BY='Reviewer Name' LUX_CLOSEOUT_EVIDENCE='Launch evidence packet 2026-06-16' node tools/set-launch-closeout-status.mjs");
  console.error("  LUX_CLOSEOUT_ITEM=inbox_notifications LUX_CLOSEOUT_STATUS=blocked LUX_CLOSEOUT_EVIDENCE='Sender domain still pending provider verification' node tools/set-launch-closeout-status.mjs");
  console.error("  LUX_CLOSEOUT_ITEM=privacy_review LUX_CLOSEOUT_STATUS=open node tools/set-launch-closeout-status.mjs");
  console.error("");
  console.error("Use LUX_CLOSEOUT_DRY_RUN=1 to validate without writing.");
  process.exit(1);
}

if (!itemArg) fail("Set LUX_CLOSEOUT_ITEM to one launch closeout item id.");
if (!validStatuses.has(statusArg)) fail("Set LUX_CLOSEOUT_STATUS to open, closed, or blocked.");
if (statusArg === "closed" && !closedBy) fail("Set LUX_CLOSEOUT_BY before marking a launch closeout item closed.");
if (statusArg === "closed" && !evidenceReference) fail("Set LUX_CLOSEOUT_EVIDENCE before marking a launch closeout item closed.");
if (evidenceReference && secretPattern.test(evidenceReference)) fail("LUX_CLOSEOUT_EVIDENCE appears to contain secret-shaped data. Store only a no-secret evidence reference.");

const manifest = JSON.parse(await readFile(file, "utf8"));
if (manifest.schemaVersion !== "luxveritas.launch_closeout.v1") {
  fail(`Unexpected launch closeout schemaVersion: ${manifest.schemaVersion || "missing"}`);
}

const now = new Date().toISOString();
let found = false;
const next = {
  ...manifest,
  updatedAt: now,
  items: manifest.items.map((item) => {
    if (item.id !== itemArg) return item;
    found = true;

    if (statusArg === "closed") {
      return {
        ...item,
        status: statusArg,
        evidenceReference,
        closedAt: now,
        closedBy
      };
    }

    return {
      ...item,
      status: statusArg,
      evidenceReference: statusArg === "blocked" ? evidenceReference : "",
      closedAt: "",
      closedBy: ""
    };
  })
};

if (!found) fail(`Launch closeout manifest is missing item: ${itemArg}`);

if (dryRun) {
  console.log(`Dry run passed for ${itemArg} -> ${statusArg}.`);
  process.exit(0);
}

await writeFile(file, `${JSON.stringify(next, null, 2)}\n`);
console.log(`Updated ${file}: ${itemArg} -> ${statusArg}.`);
