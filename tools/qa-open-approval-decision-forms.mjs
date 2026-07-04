import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const issues = [];
const identifiedDeployServiceAccount = "github-actions-firebase@lux-veritas-media.iam.gserviceaccount.com";
const targetServiceAccount = "lux-veritas-media@appspot.gserviceaccount.com";

function issue(message) {
  issues.push(message);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function secretShape(value) {
  let checked = value;
  for (const allowed of [
    identifiedDeployServiceAccount,
    `serviceAccount:${identifiedDeployServiceAccount}`,
    targetServiceAccount,
    `serviceAccount:${targetServiceAccount}`
  ]) {
    checked = checked.replace(new RegExp(escapeRegex(allowed), "g"), "KNOWN_NON_SECRET_IAM_PRINCIPAL");
  }
  return /\bre_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}|REPORT_OPERATOR_TOKEN=.*[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{16,}|FORM_INTEGRATION_URL=https:\/\/\S+|serviceAccount:[^<\s]+@[^<\s]+\.iam\.gserviceaccount\.com/i.test(checked);
}

const [markdownResult, jsonResult, approvalsRaw, docsRaw] = await Promise.all([
  execFileAsync(process.execPath, ["tools/export-open-approval-decision-forms.mjs"], {
    timeout: 30000,
    maxBuffer: 1024 * 1024 * 4
  }),
  execFileAsync(process.execPath, ["tools/export-open-approval-decision-forms.mjs"], {
    env: { ...process.env, LUX_APPROVAL_FORMS_FORMAT: "json" },
    timeout: 30000,
    maxBuffer: 1024 * 1024 * 4
  }),
  readFile("data/lux-open-approvals.json", "utf8"),
  readFile("docs/open-approval-decision-forms.md", "utf8")
]);

const markdown = markdownResult.stdout;
const jsonRaw = jsonResult.stdout;
const approvals = JSON.parse(approvalsRaw);
const docs = docsRaw;

if (secretShape(markdown) || secretShape(jsonRaw) || secretShape(docs)) {
  issue("open approval decision forms appear to contain secret-shaped data");
}

for (const marker of [
  "# Lux Veritas Open Approval Decision Forms",
  "No-secret approval decision forms",
  "Fill this record outside the public repo.",
  "Do not paste secrets",
  "Completed decision records belong in the approved private owner system",
  "Privacy Review",
  "Terms Review",
  "Functions Deploy IAM",
  "External Workflow Target",
  "Seed/Binder Private Upload",
  "Event Terms",
  "Purchase/Membership Terms",
  "Decision Record Template",
  "Version Lock",
  "Do Not Approve If",
  "No-Secret Evidence Examples",
  "approvalId",
  "reviewerName",
  "reviewedAt",
  "evidenceReference",
  "conditionsOrChanges"
]) {
  if (!markdown.includes(marker)) issue(`markdown output missing marker: ${marker}`);
  if (!docs.includes(marker)) issue(`docs/open-approval-decision-forms.md missing marker: ${marker}`);
}

let packet = null;
try {
  packet = JSON.parse(jsonRaw);
} catch (error) {
  issue(`decision forms JSON is invalid: ${error?.message || String(error)}`);
}

if (packet) {
  if (packet.schemaVersion !== "luxveritas.open_approval_decision_forms.v1") issue("schemaVersion mismatch");
  if (packet.project !== approvals.project) issue("project mismatch");
  if (packet.liveUrl !== approvals.liveUrl) issue("liveUrl mismatch");
  if (packet.decision !== approvals.decision) issue("decision mismatch");
  if (packet.counts?.totalOpenOrConditional !== approvals.counts?.totalOpenOrConditional) issue("open count mismatch");
  if (packet.counts?.publicLaunchBlockers !== approvals.counts?.publicLaunchBlockers) issue("public launch blocker count mismatch");
  if (packet.pilotEvidence?.qaRunId !== approvals.pilotEvidence?.qaRunId) issue("pilot QA run mismatch");
  if (!Array.isArray(packet.forms) || packet.forms.length !== approvals.approvals?.length) issue("form count mismatch");
  for (const rule of [
    "Do not paste secrets",
    "Completed decision records belong in the approved private owner system",
    "Use approved, needs_changes, or blocked only"
  ]) {
    if (!packet.rules?.some((item) => item.includes(rule))) issue(`packet rules missing ${rule}`);
  }

  const forms = new Map((packet.forms || []).map((form) => [form.id, form]));
  for (const approval of approvals.approvals || []) {
    const form = forms.get(approval.id);
    if (!form) {
      issue(`missing form for ${approval.id}`);
      continue;
    }
    if (form.label !== approval.label) issue(`${approval.id}: label mismatch`);
    if (form.status !== approval.status) issue(`${approval.id}: status mismatch`);
    if (form.blocksPublicLaunch !== approval.blocksPublicLaunch) issue(`${approval.id}: public-launch blocker mismatch`);
    if (form.owner !== approval.owner) issue(`${approval.id}: owner mismatch`);
    if (form.source !== approval.source) issue(`${approval.id}: source mismatch`);
    if (form.decisionIntake?.approvalId !== approval.id) issue(`${approval.id}: intake approvalId mismatch`);
    for (const value of ["approved", "needs_changes", "blocked"]) {
      if (!form.decisionIntake?.requiredDecisionValues?.includes(value)) issue(`${approval.id}: missing decision value ${value}`);
    }
    for (const field of approval.decisionIntake?.requiredFields || []) {
      if (!form.decisionIntake?.requiredFields?.includes(field)) issue(`${approval.id}: missing required field ${field}`);
      if (!Object.prototype.hasOwnProperty.call(form.decisionRecordTemplate || {}, field)) {
        issue(`${approval.id}: decision template missing field ${field}`);
      }
    }
    if (form.decisionRecordTemplate?.approvalId !== approval.id) issue(`${approval.id}: decision template approvalId mismatch`);
    if (!form.decisionIntake?.blockApprovalIf?.some((item) => /secrets|private URLs|API keys/i.test(item))) {
      issue(`${approval.id}: missing no-secret blocker`);
    }
    if (!form.decisionIntake?.noSecretEvidenceExamples?.some((item) => /without.*private|only public/i.test(item))) {
      issue(`${approval.id}: missing no-secret evidence example`);
    }
  }

  for (const id of [
    "privacy_review",
    "terms_review",
    "functions_deploy_iam",
    "external_workflow_target",
    "seed_binder_private_upload",
    "event_terms",
    "purchase_membership_terms"
  ]) {
    if (!forms.has(id)) issue(`expected form missing ${id}`);
  }
}

if (issues.length) {
  console.error(`Open approval decision forms QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log("Open approval decision forms QA passed.");
