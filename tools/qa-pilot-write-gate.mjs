import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveReportOperatorToken } from "./lib/operator-token.mjs";

const execFileAsync = promisify(execFile);
const node = process.execPath;
const baseUrl = (process.env.LUX_LIVE_URL || "https://luxveritas.media").replace(/\/$/, "");
const writeTests = process.env.LUX_PILOT_WRITE_TESTS === "1";
const dryRun = process.env.LUX_PILOT_WRITE_DRY_RUN === "1";
const qaRunId = (process.env.LUX_QA_RUN_ID || new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14))
  .replace(/[^A-Za-z0-9_-]+/g, "")
  .slice(0, 48);

const failures = [];
const passed = [];

const { token: reportToken, source: reportTokenSource } = await resolveReportOperatorToken();

const checks = [
  {
    label: "Operator Environment",
    script: "tools/qa-operator-environment.mjs",
    env: {}
  },
  {
    label: "MVP Status",
    script: "tools/qa-mvp-status.mjs",
    env: {}
  },
  {
    label: "Deploy Status",
    script: "tools/qa-deploy-status.mjs",
    env: { LUX_DEPLOY_STATUS_STRICT: "1" }
  },
  {
    label: "Domain Readiness",
    script: "tools/qa-domain-readiness.mjs",
    env: { LUX_DOMAIN_STRICT: "1" }
  },
  {
    label: "Provider Readiness",
    script: "tools/qa-provider-readiness.mjs",
    env: { LUX_PROVIDER_STRICT: "1" },
    needsReportToken: true
  },
  {
    label: "Live Site",
    script: "tools/qa-live-site.mjs",
    env: {}
  },
  {
    label: "Live Assets",
    script: "tools/qa-live-assets.mjs",
    env: {}
  },
  {
    label: "Live Media Sources",
    script: "tools/qa-live-media-sources.mjs",
    env: {}
  },
  {
    label: "Live Browser Flows",
    script: "tools/qa-browser-flows.mjs",
    env: { LUX_BROWSER_BASE_URL: baseUrl }
  },
  {
    label: "Live Operator Report",
    script: "tools/qa-live-operator-report.mjs",
    env: { LUX_OPERATOR_REPORT_STRICT: "1" },
    needsReportToken: true
  },
  {
    label: "Release Readiness",
    script: "tools/qa-release-readiness.mjs",
    env: {},
    needsReportToken: true,
    allowLegalOnly: true
  },
  (writeTests || dryRun) ? {
    label: writeTests ? "Live Form Write Matrix" : "Live Form Matrix Dry Run",
    script: "tools/qa-live-form-matrix.mjs",
    env: {
      LUX_FORM_MATRIX_WRITE: writeTests ? "1" : "0",
      LUX_EXPECT_EMAIL_SENT: writeTests ? "1" : "0",
      LUX_STRICT_LIVE_QA: "1",
      LUX_QA_RUN_ID: qaRunId
    }
  } : null,
  (writeTests || dryRun) ? {
    label: writeTests ? "Live Event Write Matrix" : "Live Event Matrix Dry Run",
    script: "tools/qa-live-event-matrix.mjs",
    env: {
      LUX_EVENT_MATRIX_WRITE: writeTests ? "1" : "0",
      LUX_STRICT_LIVE_QA: "1",
      LUX_QA_RUN_ID: qaRunId
    }
  } : null,
  writeTests ? {
    label: "Post-Write Report Reconciliation",
    script: "tools/qa-live-write-reconciliation.mjs",
    env: {
      LUX_QA_RUN_ID: qaRunId,
      LUX_QA_EXPECT_FORM_COUNT: "11",
      LUX_QA_EXPECT_EVENT_COUNT: "11"
    },
    needsReportToken: true
  } : null
].filter(Boolean);

function compactOutput(output) {
  return output
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => (
      line
      && /^(BLOCK|FAIL|WARN|PASS|- |Live |Release readiness|Provider readiness|Domain readiness|Deploy status|Operator environment|MVP status|Browser flow|Run with|Checks with warnings)/i.test(line)
    ))
    .slice(-44)
    .join("\n");
}

function releaseBlockers(output) {
  const blockers = [];
  let collecting = false;
  for (const rawLine of output.split("\n")) {
    const line = rawLine.trim();
    if (/^Release readiness blockers/i.test(line)) {
      collecting = true;
      continue;
    }
    if (collecting && /^(Release readiness checked|Run with)/i.test(line)) {
      collecting = false;
      continue;
    }
    if (collecting && /^- /.test(line)) {
      blockers.push(line.replace(/^- /, ""));
    }
  }
  return blockers;
}

function isAllowedLegalBlocker(blocker) {
  return /Privacy page legal review (complete|is approved|is not approved)/i.test(blocker)
    || /Terms page legal review (complete|is approved|is not approved)/i.test(blocker);
}

async function runCheck(check) {
  const env = { ...process.env, ...check.env };
  if (check.needsReportToken && reportToken) env.LUX_REPORT_TOKEN = reportToken;

  try {
    const { stdout, stderr } = await execFileAsync(node, [check.script], {
      env,
      timeout: 180000,
      maxBuffer: 1024 * 1024 * 14
    });
    const output = `${stdout || ""}${stderr || ""}`;
    if (check.allowLegalOnly) {
      const unexpected = releaseBlockers(output).filter((blocker) => !isAllowedLegalBlocker(blocker));
      if (unexpected.length) {
        failures.push({
          label: check.label,
          output: `Release readiness found non-legal blocker(s):\n${unexpected.map((item) => `- ${item}`).join("\n")}`
        });
        console.log(`FAIL ${check.label}`);
        return;
      }
    }
    passed.push(check.label);
    console.log(`PASS ${check.label}`);
    const summary = compactOutput(output);
    if (summary) console.log(summary);
  } catch (error) {
    const output = `${error.stdout || ""}${error.stderr || ""}`;
    failures.push({ label: check.label, output: compactOutput(output) || error.message });
    console.log(`FAIL ${check.label}`);
  }
}

console.log("Lux Veritas pilot write gate");
console.log(`Live URL: ${baseUrl}`);
console.log(`Write tests: ${writeTests ? "enabled" : dryRun ? "dry-run only" : "disabled"}`);
console.log(`QA run ID: ${qaRunId}`);
console.log(`Operator token source: ${reportTokenSource}`);

for (const check of checks) {
  await runCheck(check);
}

if (!writeTests && !dryRun) {
  failures.push({
    label: "Pilot Write Tests",
    output: "Set LUX_PILOT_WRITE_TESTS=1 to send live QA submissions/events and prove the pilot capture/reporting loop. Use LUX_PILOT_WRITE_DRY_RUN=1 only for a non-writing rehearsal."
  });
  console.log("FAIL Pilot Write Tests");
}

if (dryRun) {
  console.log("");
  console.log("Dry-run note: this did not send live submissions or event writes, so it is not pilot-write acceptance evidence.");
}

if (failures.length) {
  console.log("");
  console.log(`Pilot write gate found ${failures.length} blocking check(s):`);
  for (const failure of failures) {
    console.log(`\n[${failure.label}]`);
    console.log(failure.output);
  }
  process.exit(1);
}

console.log("");
console.log(`Pilot write gate checked: ${passed.length} passed, ${failures.length} blocking check(s).`);
console.log("Known public-release blockers still require separate legal approval: Privacy and Terms.");
