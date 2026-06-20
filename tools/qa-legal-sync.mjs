import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const node = process.execPath;
const files = [
  "data/lux-legal-review.json",
  "data/lux-launch-readiness.json",
  "data/lux-launch-closeout.json"
];
const issues = [];

function issue(message) {
  issues.push(message);
}

async function fileSnapshot() {
  return Object.fromEntries(await Promise.all(files.map(async (file) => [file, await readFile(file, "utf8")])));
}

function assertUnchanged(before, after, label) {
  for (const file of files) {
    if (before[file] !== after[file]) {
      issue(`${label}: dry-run changed ${file}`);
    }
  }
}

async function runLegalSync(label, env, expectOk = true, expectedText = "") {
  const before = await fileSnapshot();
  try {
    const { stdout, stderr } = await execFileAsync(node, ["tools/set-legal-review-status.mjs"], {
      env: { ...process.env, ...env, LUX_LEGAL_DRY_RUN: "1" },
      timeout: 30000,
      maxBuffer: 1024 * 1024
    });
    const output = `${stdout || ""}${stderr || ""}`;
    if (!expectOk) {
      issue(`${label}: expected failure but command passed`);
    }
    if (expectedText && !output.includes(expectedText)) {
      issue(`${label}: output missing "${expectedText}"`);
    }
  } catch (error) {
    const output = `${error.stdout || ""}${error.stderr || ""}${error.message || ""}`;
    if (expectOk) {
      issue(`${label}: expected success but failed: ${output.trim()}`);
    }
    if (expectedText && !output.includes(expectedText)) {
      issue(`${label}: failure output missing "${expectedText}"`);
    }
  }
  const after = await fileSnapshot();
  assertUnchanged(before, after, label);
}

await runLegalSync("privacy approved sync", {
  LUX_LEGAL_SYNC_LAUNCH: "1",
  LUX_LEGAL_EVIDENCE: "Legal review packet QA dry-run",
  LUX_LEGAL_REVIEW_ITEM: "privacy",
  LUX_LEGAL_REVIEW_STATUS: "approved",
  LUX_LEGAL_REVIEWED_BY: "QA Reviewer"
}, true, "Dry run passed for privacy -> approved with launch sync.");

await runLegalSync("terms approved sync", {
  LUX_LEGAL_SYNC_LAUNCH: "1",
  LUX_LEGAL_EVIDENCE: "Legal review packet QA dry-run",
  LUX_LEGAL_REVIEW_ITEM: "terms",
  LUX_LEGAL_REVIEW_STATUS: "approved",
  LUX_LEGAL_REVIEWED_BY: "QA Reviewer"
}, true, "Dry run passed for terms -> approved with launch sync.");

await runLegalSync("reset both legal blockers", {
  LUX_LEGAL_SYNC_LAUNCH: "1",
  LUX_LEGAL_REVIEW_ITEM: "all",
  LUX_LEGAL_REVIEW_STATUS: "needs_review"
}, true, "Dry run passed for privacy, terms -> needs_review with launch sync.");

await runLegalSync("missing evidence guard", {
  LUX_LEGAL_SYNC_LAUNCH: "1",
  LUX_LEGAL_REVIEW_ITEM: "privacy",
  LUX_LEGAL_REVIEW_STATUS: "approved",
  LUX_LEGAL_REVIEWED_BY: "QA Reviewer"
}, false, "Set LUX_LEGAL_EVIDENCE before syncing approved legal review to launch closeout.");

await runLegalSync("secret-shaped evidence guard", {
  LUX_LEGAL_SYNC_LAUNCH: "1",
  LUX_LEGAL_EVIDENCE: "re_secretlike1234567890",
  LUX_LEGAL_REVIEW_ITEM: "terms",
  LUX_LEGAL_REVIEW_STATUS: "approved",
  LUX_LEGAL_REVIEWED_BY: "QA Reviewer"
}, false, "LUX_LEGAL_EVIDENCE appears to contain secret-shaped data.");

if (issues.length) {
  console.error(`Legal sync QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log("Legal sync QA passed.");
