import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const node = process.execPath;
const issues = [];
const mutableFiles = [
  "data/lux-legal-review.json",
  "data/lux-launch-readiness.json",
  "data/lux-launch-closeout.json"
];
const approvalIds = ["privacy_review", "terms_review"];
const legalItemByApproval = {
  privacy_review: "privacy",
  terms_review: "terms"
};
const versionKeyByApproval = {
  privacy_review: "privacyVersion",
  terms_review: "termsVersion"
};
const routeByApproval = {
  privacy_review: "/legal/privacy.html",
  terms_review: "/legal/terms.html"
};
const secretPattern = /\bre_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}|REPORT_OPERATOR_TOKEN=.*[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{16,}|FORM_INTEGRATION_URL=https:\/\/\S+|[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/i;

function issue(message) {
  issues.push(message);
}

async function snapshot() {
  return Object.fromEntries(await Promise.all(mutableFiles.map(async (file) => [file, await readFile(file, "utf8")])));
}

function assertSnapshotUnchanged(before, after, label) {
  for (const file of mutableFiles) {
    if (before[file] !== after[file]) issue(`${label}: dry-run changed ${file}`);
  }
}

function byId(values, id, label) {
  const found = values.find((item) => item.id === id);
  if (!found) issue(`missing ${label}: ${id}`);
  return found;
}

function includesAll(values, required, label) {
  for (const value of required) {
    if (!values.includes(value)) issue(`${label}: missing ${value}`);
  }
}

async function runDryRun(label, env, expectedText, expectOk = true) {
  const before = await snapshot();
  try {
    const { stdout, stderr } = await execFileAsync(node, ["tools/set-legal-review-status.mjs"], {
      env: { ...process.env, ...env, LUX_LEGAL_DRY_RUN: "1" },
      timeout: 30000,
      maxBuffer: 1024 * 1024
    });
    const output = `${stdout || ""}${stderr || ""}`;
    if (!expectOk) issue(`${label}: expected failure but passed`);
    if (expectedText && !output.includes(expectedText)) {
      issue(`${label}: output missing "${expectedText}"`);
    }
    if (secretPattern.test(output)) issue(`${label}: dry-run output contains secret-shaped data`);
  } catch (error) {
    const output = `${error.stdout || ""}${error.stderr || ""}${error.message || ""}`;
    if (expectOk) issue(`${label}: expected success but failed: ${output.trim()}`);
    if (expectedText && !output.includes(expectedText)) {
      issue(`${label}: failure output missing "${expectedText}"`);
    }
    if (secretPattern.test(output)) issue(`${label}: failure output contains secret-shaped data`);
  }
  const after = await snapshot();
  assertSnapshotUnchanged(before, after, label);
}

const [
  legalRaw,
  launchRaw,
  closeoutRaw,
  publicTermsRaw,
  formsResult,
  docsRaw
] = await Promise.all([
  readFile("data/lux-legal-review.json", "utf8"),
  readFile("data/lux-launch-readiness.json", "utf8"),
  readFile("data/lux-launch-closeout.json", "utf8"),
  readFile("data/lux-public-terms.json", "utf8"),
  execFileAsync(node, ["tools/export-open-approval-decision-forms.mjs"], {
    env: { ...process.env, LUX_APPROVAL_FORMS_FORMAT: "json" },
    timeout: 30000,
    maxBuffer: 1024 * 1024 * 4
  }),
  readFile("docs/open-approval-decision-forms.md", "utf8")
]);

if (secretPattern.test(formsResult.stdout) || secretPattern.test(docsRaw)) {
  issue("approval decision forms contain secret-shaped data");
}

let legal = null;
let launch = null;
let closeout = null;
let publicTerms = null;
let formsPacket = null;

try {
  legal = JSON.parse(legalRaw);
  launch = JSON.parse(launchRaw);
  closeout = JSON.parse(closeoutRaw);
  publicTerms = JSON.parse(publicTermsRaw);
  formsPacket = JSON.parse(formsResult.stdout);
} catch (error) {
  issue(`invalid JSON in legal closeout inputs: ${error?.message || String(error)}`);
}

if (legal?.schemaVersion !== "luxveritas.legal_review.v1") issue("legal review schemaVersion mismatch");
if (closeout?.schemaVersion !== "luxveritas.launch_closeout.v1") issue("launch closeout schemaVersion mismatch");
if (publicTerms?.schemaVersion !== "luxveritas.public_terms.v1") issue("public terms schemaVersion mismatch");
if (formsPacket?.schemaVersion !== "luxveritas.open_approval_decision_forms.v1") issue("approval forms schemaVersion mismatch");

const forms = formsPacket ? new Map((formsPacket.forms || []).map((form) => [form.id, form])) : new Map();

for (const approvalId of approvalIds) {
  const legalId = legalItemByApproval[approvalId];
  const versionKey = versionKeyByApproval[approvalId];
  const route = routeByApproval[approvalId];
  const legalItem = legal ? byId(legal.items || [], legalId, "legal review item") : null;
  const launchGate = launch ? byId(launch.gates || [], approvalId, "launch readiness gate") : null;
  const closeoutItem = closeout ? byId(closeout.items || [], approvalId, "launch closeout item") : null;
  const form = forms.get(approvalId);

  if (!form) {
    issue(`missing approval decision form: ${approvalId}`);
    continue;
  }

  if (legalItem?.status !== "needs_review") issue(`${approvalId}: expected legal status needs_review until real external approval`);
  if (legalItem?.reviewedAt !== null) issue(`${approvalId}: reviewedAt should remain null before real external approval`);
  if (legalItem?.reviewedBy !== null) issue(`${approvalId}: reviewedBy should remain null before real external approval`);
  if (launchGate?.status !== "blocked") issue(`${approvalId}: launch gate should remain blocked before real external approval`);
  if (closeoutItem?.status !== "open") issue(`${approvalId}: closeout item should remain open before real external approval`);
  if (form.status !== "open") issue(`${approvalId}: approval form status should be open`);
  if (form.blocksPublicLaunch !== true) issue(`${approvalId}: approval form should block public launch`);
  if (form.decisionIntake?.approvalId !== approvalId) issue(`${approvalId}: decision intake approvalId mismatch`);
  includesAll(form.decisionIntake?.requiredDecisionValues || [], ["approved", "needs_changes", "blocked"], `${approvalId} decision values`);
  includesAll(form.decisionIntake?.requiredFields || [], [
    "approvalId",
    "reviewerName",
    "reviewedAt",
    "decision",
    "evidenceReference",
    "route",
    "legalVersion",
    "publicTermsVersion",
    versionKey,
    "reviewScope"
  ], `${approvalId} required fields`);
  if (form.decisionRecordTemplate?.approvalId !== approvalId) issue(`${approvalId}: decision record template approvalId mismatch`);
  if (form.decisionIntake?.versionLock?.route !== route) issue(`${approvalId}: route version lock mismatch`);
  if (form.decisionIntake?.versionLock?.legalVersion !== legalItem?.version) issue(`${approvalId}: legal version lock mismatch`);
  if (form.decisionIntake?.versionLock?.publicTermsVersion !== publicTerms?.version) issue(`${approvalId}: public terms version lock mismatch`);
  if (form.decisionIntake?.versionLock?.[versionKey] !== publicTerms?.[versionKey]) issue(`${approvalId}: ${versionKey} lock mismatch`);
  if (!form.decisionIntake?.blockApprovalIf?.some((item) => /live .*differs|reviewed live route/i.test(item))) {
    issue(`${approvalId}: missing live-route/version approval blocker`);
  }
  if (!form.decisionIntake?.noSecretEvidenceExamples?.some((item) => /without quoted secrets|Internal approval record ID/i.test(item))) {
    issue(`${approvalId}: missing no-secret evidence example`);
  }
  if (!closeoutItem?.commands?.some((command) => command.includes(`LUX_LEGAL_REVIEW_ITEM=${legalId}`))) {
    issue(`${approvalId}: closeout commands missing legal item command`);
  }
  if (!closeoutItem?.commands?.some((command) => command.includes("LUX_LEGAL_SYNC_LAUNCH=1"))) {
    issue(`${approvalId}: closeout commands missing launch sync flag`);
  }
}

for (const marker of [
  "Privacy Review",
  "Terms Review",
  "Decision Record Template",
  "Version Lock",
  "Do Not Approve If",
  "No-Secret Evidence Examples"
]) {
  if (!docsRaw.includes(marker)) issue(`docs/open-approval-decision-forms.md missing marker: ${marker}`);
}

await runDryRun("privacy approval closeout rehearsal", {
  LUX_LEGAL_SYNC_LAUNCH: "1",
  LUX_LEGAL_EVIDENCE: "Open approval decision form privacy_review YYYY-MM-DD",
  LUX_LEGAL_REVIEW_ITEM: "privacy",
  LUX_LEGAL_REVIEW_STATUS: "approved",
  LUX_LEGAL_REVIEWED_BY: "Legal Reviewer"
}, "Dry run passed for privacy -> approved with launch sync.");

await runDryRun("terms approval closeout rehearsal", {
  LUX_LEGAL_SYNC_LAUNCH: "1",
  LUX_LEGAL_EVIDENCE: "Open approval decision form terms_review YYYY-MM-DD",
  LUX_LEGAL_REVIEW_ITEM: "terms",
  LUX_LEGAL_REVIEW_STATUS: "approved",
  LUX_LEGAL_REVIEWED_BY: "Legal Reviewer"
}, "Dry run passed for terms -> approved with launch sync.");

await runDryRun("legal approval missing reviewer guard", {
  LUX_LEGAL_SYNC_LAUNCH: "1",
  LUX_LEGAL_EVIDENCE: "Open approval decision form privacy_review YYYY-MM-DD",
  LUX_LEGAL_REVIEW_ITEM: "privacy",
  LUX_LEGAL_REVIEW_STATUS: "approved"
}, "Set LUX_LEGAL_REVIEWED_BY before marking legal review approved.", false);

if (issues.length) {
  console.error(`Legal approval closeout QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log("Legal approval closeout QA passed.");
