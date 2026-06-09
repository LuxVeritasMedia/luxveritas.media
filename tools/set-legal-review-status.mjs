import { readFile, writeFile } from "node:fs/promises";

const file = "data/lux-legal-review.json";
const itemArg = (process.env.LUX_LEGAL_REVIEW_ITEM || "").trim().toLowerCase();
const statusArg = (process.env.LUX_LEGAL_REVIEW_STATUS || "").trim().toLowerCase();
const reviewedBy = (process.env.LUX_LEGAL_REVIEWED_BY || "").trim();
const dryRun = process.env.LUX_LEGAL_DRY_RUN === "1";
const validItems = new Set(["privacy", "terms", "all"]);
const validStatuses = new Set(["approved", "needs_review"]);

function fail(message) {
  console.error(message);
  console.error("");
  console.error("Usage:");
  console.error("  LUX_LEGAL_REVIEW_ITEM=privacy LUX_LEGAL_REVIEW_STATUS=approved LUX_LEGAL_REVIEWED_BY='Reviewer Name' node tools/set-legal-review-status.mjs");
  console.error("  LUX_LEGAL_REVIEW_ITEM=all LUX_LEGAL_REVIEW_STATUS=needs_review node tools/set-legal-review-status.mjs");
  console.error("");
  console.error("Use LUX_LEGAL_DRY_RUN=1 to validate without writing.");
  process.exit(1);
}

if (!validItems.has(itemArg)) fail("Set LUX_LEGAL_REVIEW_ITEM to privacy, terms, or all.");
if (!validStatuses.has(statusArg)) fail("Set LUX_LEGAL_REVIEW_STATUS to approved or needs_review.");
if (statusArg === "approved" && !reviewedBy) fail("Set LUX_LEGAL_REVIEWED_BY before marking legal review approved.");

const manifest = JSON.parse(await readFile(file, "utf8"));
if (manifest.schemaVersion !== "luxveritas.legal_review.v1") {
  fail(`Unexpected legal review schemaVersion: ${manifest.schemaVersion || "missing"}`);
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

if (dryRun) {
  console.log(`Dry run passed for ${targets.join(", ")} -> ${statusArg}.`);
  process.exit(0);
}

await writeFile(file, `${JSON.stringify(next, null, 2)}\n`);
console.log(`Updated ${file}: ${targets.join(", ")} -> ${statusArg}.`);
