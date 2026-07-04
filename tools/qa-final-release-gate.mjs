import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const node = process.execPath;
const allowBlockers = process.env.LUX_FINAL_ALLOW_BLOCKERS === "1";
const skipBrowser = process.env.LUX_FINAL_SKIP_BROWSER === "1";
const skipLive = process.env.LUX_FINAL_SKIP_LIVE === "1";
const writeTests = process.env.LUX_FINAL_WRITE_TESTS === "1";

const checks = [
  {
    label: "Operator Environment",
    script: "tools/qa-operator-environment.mjs",
    env: {}
  },
  {
    label: "MVP Status",
    script: "tools/qa-mvp-status.mjs",
    env: { LUX_MVP_STATUS_REQUIRE_CURRENT_PILOT: writeTests ? "1" : "0" }
  },
  {
    label: "MVP Preflight",
    script: "tools/qa-mvp-preflight.mjs",
    env: {
      LUX_MVP_PREFLIGHT_STRICT: "1",
      LUX_MVP_STATUS_REQUIRE_CURRENT_PILOT: writeTests ? "1" : "0",
      LUX_PILOT_WRITE_EVIDENCE_STRICT: writeTests ? "1" : "0"
    }
  },
  {
    label: "Launch Evidence",
    script: "tools/qa-launch-evidence.mjs",
    env: {}
  },
  {
    label: "Pilot Bug Register",
    script: "tools/qa-pilot-bug-register.mjs",
    env: {}
  },
  {
    label: "Open Approvals",
    script: "tools/qa-open-approvals.mjs",
    env: {}
  },
  {
    label: "Open Approval Decision Forms",
    script: "tools/qa-open-approval-decision-forms.mjs",
    env: {}
  },
  {
    label: "Legal Sync",
    script: "tools/qa-legal-sync.mjs",
    env: {}
  },
  {
    label: "Legal Approval Closeout",
    script: "tools/qa-legal-approval-closeout.mjs",
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
    env: { LUX_PROVIDER_STRICT: "1" }
  },
  {
    label: "Live Operator Report",
    script: "tools/qa-live-operator-report.mjs",
    env: { LUX_OPERATOR_REPORT_STRICT: writeTests ? "1" : "0" }
  },
  {
    label: "Release Readiness",
    script: "tools/qa-release-readiness.mjs",
    env: { LUX_RELEASE_STRICT: "1" }
  },
  {
    label: "Full Pilot Readiness",
    script: "tools/qa-pilot-readiness.mjs",
    env: {
      LUX_PILOT_BROWSER: skipBrowser ? "0" : "1",
      LUX_PILOT_LIVE: skipLive ? "0" : "1",
      LUX_PILOT_STRICT: "1",
      LUX_MVP_STATUS_REQUIRE_CURRENT_PILOT: writeTests ? "1" : "0",
      LUX_PILOT_WRITE_EVIDENCE_STRICT: writeTests ? "1" : "0",
      LUX_LIVE_SITE_REQUIRE_CURRENT_PILOT: writeTests ? "1" : "0"
    }
  },
  writeTests ? {
    label: "Live Form Write Matrix",
    script: "tools/qa-live-form-matrix.mjs",
    env: {
      LUX_FORM_MATRIX_WRITE: "1",
      LUX_EXPECT_EMAIL_SENT: "1",
      LUX_STRICT_LIVE_QA: "1"
    }
  } : null,
  writeTests ? {
    label: "Live Event Write Matrix",
    script: "tools/qa-live-event-matrix.mjs",
    env: {
      LUX_EVENT_MATRIX_WRITE: "1",
      LUX_STRICT_LIVE_QA: "1"
    }
  } : null
].filter(Boolean);

const failures = [];
const passed = [];

function compactOutput(output) {
  return output
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => (
      line
      && /^(BLOCK|FAIL|WARN|- |Launch blockers|Release readiness|Provider readiness|Domain readiness|Deploy status|Pilot readiness|Operator environment|MVP status|MVP preflight|Preflight|Run with|Checks with warnings)/i.test(line)
    ))
    .slice(-30)
    .join("\n");
}

async function runCheck(check) {
  try {
    const { stdout, stderr } = await execFileAsync(node, [check.script], {
      env: { ...process.env, ...check.env },
      maxBuffer: 1024 * 1024 * 12
    });
    passed.push(check.label);
    const warnings = compactOutput(`${stdout || ""}${stderr || ""}`);
    console.log(`PASS ${check.label}`);
    if (warnings) console.log(warnings);
  } catch (error) {
    const output = `${error.stdout || ""}${error.stderr || ""}`;
    failures.push({ label: check.label, output: compactOutput(output) || error.message });
    console.log(`FAIL ${check.label}`);
  }
}

console.log("Lux Veritas final release gate");
console.log(`Browser coverage: ${skipBrowser ? "skipped" : "enabled"}`);
console.log(`Live coverage: ${skipLive ? "skipped" : "enabled"}`);
console.log(`Write tests: ${writeTests ? "enabled" : "disabled"}`);
console.log(`Allow blockers: ${allowBlockers ? "yes" : "no"}`);

for (const check of checks) {
  await runCheck(check);
}

if (!writeTests) {
  failures.push({
    label: "Final Write Tests",
    output: "Set LUX_FINAL_WRITE_TESTS=1 for release approval. This enables real live form submissions with inbox delivery required and live event reporting writes."
  });
  console.log("FAIL Final Write Tests");
}

if (skipBrowser || skipLive) {
  failures.push({
    label: "Final Coverage",
    output: "Do not set LUX_FINAL_SKIP_BROWSER=1 or LUX_FINAL_SKIP_LIVE=1 for release approval. Browser and live coverage are required for the final gate."
  });
  console.log("FAIL Final Coverage");
}

if (failures.length) {
  console.log("");
  console.log(`Final release gate found ${failures.length} blocking check(s):`);
  for (const failure of failures) {
    console.log(`\n[${failure.label}]`);
    console.log(failure.output);
  }
  if (!allowBlockers) process.exit(1);
}

console.log("");
console.log(`Final release gate checked: ${passed.length} passed, ${failures.length} blocking check(s).`);
if (failures.length && allowBlockers) {
  console.log("LUX_FINAL_ALLOW_BLOCKERS=1 was set, so blockers were reported without failing the command.");
}
