import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const strict = process.env.LUX_MVP_PREFLIGHT_STRICT === "1";
const node = process.execPath;

const checks = [
  {
    label: "Operator Environment",
    script: "tools/qa-operator-environment.mjs"
  },
  {
    label: "Preview Helper",
    script: "tools/qa-preview-helper.mjs"
  },
  {
    label: "Private Upload Manifest",
    script: "tools/qa-private-upload-manifest.mjs"
  },
  {
    label: "Private Workflow Approval Closeout",
    script: "tools/qa-private-workflow-approval-closeout.mjs"
  },
  {
    label: "Deploy Status",
    script: "tools/qa-deploy-status.mjs"
  },
  {
    label: "Functions Deploy Readiness",
    script: "tools/qa-functions-deploy-readiness.mjs"
  },
  {
    label: "Resend Inbox Activation Terminal",
    script: "tools/qa-resend-inbox-activation-terminal.mjs"
  },
  {
    label: "Action Inventory",
    script: "tools/qa-action-inventory.mjs"
  },
  {
    label: "Launch Blockers",
    script: "tools/qa-launch-blockers.mjs"
  },
  {
    label: "Open Approval Decision Forms",
    script: "tools/qa-open-approval-decision-forms.mjs"
  },
  {
    label: "Legal Approval Closeout",
    script: "tools/qa-legal-approval-closeout.mjs"
  },
  {
    label: "MVP Status",
    script: "tools/qa-mvp-status.mjs"
  },
  {
    label: "Release Readiness",
    script: "tools/qa-release-readiness.mjs"
  }
];

const passed = [];
const failures = [];
const warnings = [];
const blockers = [];

function compactOutput(output) {
  return output
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => (
      line
      && /^(BLOCK|FAIL|WARN|- |Release readiness|Provider readiness|Domain readiness|Deploy status|Operator environment|MVP status|Launch blocker|Warnings should|Run with|Checks with warnings)/i.test(line)
    ))
    .slice(-40)
    .join("\n");
}

function collectSignals(output, label) {
  let collectingBlockers = false;
  for (const rawLine of output.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^WARN\b/i.test(line)) warnings.push(`${label}: ${line.replace(/^WARN\s*/i, "")}`);
    if (/^BLOCK\b/i.test(line)) blockers.push(`${label}: ${line.replace(/^BLOCK\s*/i, "")}`);
    if (/blockers?(?:\s+with|:)/i.test(line) && !/warnings/i.test(line)) {
      collectingBlockers = true;
      continue;
    }
    if (collectingBlockers && /^(Run with|Release readiness checked|Provider readiness checked|Domain readiness checked|Deploy status checked|Operator environment checked|MVP status QA|Preflight)/i.test(line)) {
      collectingBlockers = false;
      continue;
    }
    if (collectingBlockers && /^- /.test(line)) {
      blockers.push(`${label}: ${line.replace(/^- /, "")}`);
    }
  }
}

async function runCheck(check) {
  try {
    const { stdout, stderr } = await execFileAsync(node, [check.script], {
      env: process.env,
      timeout: 90000,
      maxBuffer: 1024 * 1024 * 10
    });
    const output = `${stdout || ""}${stderr || ""}`;
    collectSignals(output, check.label);
    passed.push(check.label);
    console.log(`PASS ${check.label}`);
    const summary = compactOutput(output);
    if (summary) console.log(summary);
  } catch (error) {
    const output = `${error.stdout || ""}${error.stderr || ""}`;
    collectSignals(output, check.label);
    failures.push({ label: check.label, output: compactOutput(output) || error.message });
    console.log(`FAIL ${check.label}`);
  }
}

console.log("Lux Veritas MVP preflight");
console.log(`Strict mode: ${strict ? "enabled" : "disabled"}`);

for (const check of checks) {
  await runCheck(check);
}

const uniqueWarnings = [...new Set(warnings)];
const uniqueBlockers = [...new Set(blockers)];

if (uniqueWarnings.length) {
  console.log("");
  console.log("Preflight warnings:");
  for (const warning of uniqueWarnings) console.log(`- ${warning}`);
}

if (uniqueBlockers.length) {
  console.log("");
  console.log("Preflight blockers:");
  for (const blocker of uniqueBlockers) console.log(`- ${blocker}`);
}

if (failures.length) {
  console.log("");
  console.log(`Preflight check failures (${failures.length}):`);
  for (const failure of failures) {
    console.log(`\n[${failure.label}]`);
    console.log(failure.output);
  }
}

console.log("");
console.log(`MVP preflight checked: ${passed.length} passed, ${failures.length} failed, ${uniqueWarnings.length} warning(s), ${uniqueBlockers.length} blocker signal(s).`);
if (strict && (failures.length || uniqueBlockers.length)) process.exit(1);
if (!strict && (failures.length || uniqueBlockers.length)) {
  console.log("Run with LUX_MVP_PREFLIGHT_STRICT=1 when blocker signals should fail this command.");
}
