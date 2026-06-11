import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const node = process.execPath;
const allowBlockers = process.env.LUX_FINAL_ALLOW_BLOCKERS === "1";
const skipBrowser = process.env.LUX_FINAL_SKIP_BROWSER === "1";
const skipLive = process.env.LUX_FINAL_SKIP_LIVE === "1";

const checks = [
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
      LUX_PILOT_STRICT: "1"
    }
  }
];

const failures = [];
const passed = [];

function compactOutput(output) {
  return output
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => (
      line
      && /^(BLOCK|FAIL|WARN|- |Launch blockers|Release readiness|Provider readiness|Domain readiness|Deploy status|Pilot readiness|Run with|Checks with warnings)/i.test(line)
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
console.log(`Allow blockers: ${allowBlockers ? "yes" : "no"}`);

for (const check of checks) {
  await runCheck(check);
}

if (failures.length) {
  console.error("");
  console.error(`Final release gate found ${failures.length} blocking check(s):`);
  for (const failure of failures) {
    console.error(`\n[${failure.label}]`);
    console.error(failure.output);
  }
  if (!allowBlockers) process.exit(1);
}

console.log("");
console.log(`Final release gate checked: ${passed.length} passed, ${failures.length} blocking check(s).`);
if (failures.length && allowBlockers) {
  console.log("LUX_FINAL_ALLOW_BLOCKERS=1 was set, so blockers were reported without failing the command.");
}
