import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const format = process.env.LUX_APPROVAL_FORMS_FORMAT === "json" ? "json" : "markdown";
const outPath = process.env.LUX_APPROVAL_FORMS_OUT || "";
const identifiedDeployServiceAccount = "github-actions-firebase@lux-veritas-media.iam.gserviceaccount.com";
const targetServiceAccount = "lux-veritas-media@appspot.gserviceaccount.com";

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

function cleanList(values) {
  return Array.isArray(values) ? values.filter(Boolean) : [];
}

function templateFor(intake) {
  const template = {};
  for (const field of cleanList(intake.requiredFields)) {
    template[field] = field === "approvalId" ? intake.approvalId : "";
  }
  return template;
}

function renderValue(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function renderList(values) {
  const items = cleanList(values);
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- None";
}

function renderVersionLock(versionLock) {
  const entries = Object.entries(versionLock || {});
  return entries.length ? entries.map(([key, value]) => `- ${key}: ${renderValue(value)}`).join("\n") : "- None";
}

const reportResult = await execFileAsync(process.execPath, ["tools/report-open-approvals.mjs"], {
  env: { ...process.env, LUX_OPEN_APPROVALS_JSON: "1" },
  timeout: 30000,
  maxBuffer: 1024 * 1024 * 4
});

const report = JSON.parse(reportResult.stdout);
const forms = cleanList(report.approvals).map((approval) => {
  const intake = approval.decisionIntake || {};
  return {
    id: approval.id,
    label: approval.label,
    category: approval.category,
    status: approval.status,
    blocksPublicLaunch: approval.blocksPublicLaunch,
    owner: approval.owner,
    source: approval.source,
    nextAction: approval.nextAction,
    verification: approval.verification,
    decisionIntake: {
      approvalId: intake.approvalId || approval.id,
      purpose: intake.purpose || "",
      requiredDecisionValues: cleanList(intake.requiredDecisionValues),
      requiredFields: cleanList(intake.requiredFields),
      versionLock: intake.versionLock || {},
      blockApprovalIf: cleanList(intake.blockApprovalIf),
      noSecretEvidenceExamples: cleanList(intake.noSecretEvidenceExamples)
    },
    decisionRecordTemplate: templateFor({ ...intake, approvalId: intake.approvalId || approval.id })
  };
});

const packet = {
  schemaVersion: "luxveritas.open_approval_decision_forms.v1",
  generatedAt: report.generatedAt,
  purpose: "No-secret approval decision forms for private reviewer records. Fill completed decisions outside the public repo.",
  project: report.project,
  liveUrl: report.liveUrl,
  decision: report.decision,
  counts: report.counts,
  pilotEvidence: report.pilotEvidence,
  rules: [
    "Do not paste secrets, private URLs, provider account IDs, legal advice, private report exports, contract terms, or non-public operational details into these forms.",
    "Completed decision records belong in the approved private owner system, not in this public website repo.",
    "Use approved, needs_changes, or blocked only.",
    "If a blocker condition is true, record the decision as needs_changes or blocked and resolve it before activation."
  ],
  forms
};

let rendered = "";
if (format === "json") {
  rendered = `${JSON.stringify(packet, null, 2)}\n`;
} else {
  const formSections = forms.map((form) => {
    const fieldRows = Object.entries(form.decisionRecordTemplate)
      .map(([field, value]) => `| ${field} | ${value ? `\`${value}\`` : ""} |`)
      .join("\n");
    return `## ${form.label} (\`${form.id}\`)

- Category: ${form.category}
- Status: ${form.status}
- Blocks public launch: ${form.blocksPublicLaunch ? "yes" : "no"}
- Owner: ${form.owner}
- Source: ${form.source}

Purpose: ${form.decisionIntake.purpose}

Required decision values: ${form.decisionIntake.requiredDecisionValues.join(", ") || "missing"}

### Decision Record Template

Fill this record outside the public repo.

| Field | Value |
| --- | --- |
${fieldRows || "| approvalId | |"}

### Version Lock

${renderVersionLock(form.decisionIntake.versionLock)}

### Do Not Approve If

${renderList(form.decisionIntake.blockApprovalIf)}

### No-Secret Evidence Examples

${renderList(form.decisionIntake.noSecretEvidenceExamples)}

### Next Action

${form.nextAction}

### Verification

\`${form.verification}\``;
  }).join("\n\n");

  rendered = `# Lux Veritas Open Approval Decision Forms

Generated: ${packet.generatedAt}

Purpose: ${packet.purpose}

Project: ${packet.project}
Live URL: ${packet.liveUrl}
Decision: ${packet.decision}
Open or conditional approvals: ${packet.counts?.totalOpenOrConditional ?? "unknown"}
Public launch blockers: ${packet.counts?.publicLaunchBlockers ?? "unknown"}

Pilot evidence: ${packet.pilotEvidence?.result || "unknown"} run=${packet.pilotEvidence?.qaRunId || "unknown"} forms=${packet.pilotEvidence?.formCaptureIntents ?? "unknown"} events=${packet.pilotEvidence?.eventWrites ?? "unknown"}

## Rules

${renderList(packet.rules)}

${formSections}
`;
}

if (secretShape(rendered)) {
  console.error("Open approval decision forms appear to contain secret-shaped data.");
  process.exit(1);
}

if (outPath) {
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, rendered);
  console.log(`Exported open approval decision forms to ${outPath}.`);
} else {
  process.stdout.write(rendered);
}
