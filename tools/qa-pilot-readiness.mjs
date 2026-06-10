import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const strict = process.env.LUX_PILOT_STRICT === "1";
const includeBrowser = process.env.LUX_PILOT_BROWSER === "1";
const includeLive = process.env.LUX_PILOT_LIVE === "1";
const node = process.execPath;

const setupChecks = [
  ["Build Static", "tools/build-static.mjs"],
  ["Prepare Hosting", "tools/prepare-hosting.mjs"]
];

const checks = [
  ["Buttons", "tools/qa-buttons.mjs"],
  ["Public Site", "tools/qa-public-site.mjs"],
  ["Access Model", "tools/qa-access-model.mjs"],
  ["Integrations", "tools/qa-integrations.mjs"],
  ["Integration Contract", "tools/qa-integration-contract.mjs"],
  ["Integration Profiles", "tools/qa-integration-profiles.mjs"],
  ["Release Handoff", "tools/qa-release-handoff.mjs"],
  ["Media Contract", "tools/qa-media-contract.mjs"],
  ["Mobile Layout", "tools/qa-mobile-layout.mjs"],
  ["Accessibility", "tools/qa-accessibility.mjs"],
  ["Hosting Config", "tools/qa-hosting-config.mjs"],
  ["Workflows", "tools/qa-workflows.mjs"],
  includeBrowser ? ["Browser Flows", "tools/qa-browser-flows.mjs"] : null,
  includeLive ? ["Form Delivery", "tools/qa-form-delivery.mjs"] : null,
  includeLive ? ["Live Site", "tools/qa-live-site.mjs"] : null,
  includeLive ? ["Domain Readiness", "tools/qa-domain-readiness.mjs"] : null,
  includeLive ? ["Provider Readiness", "tools/qa-provider-readiness.mjs"] : null,
  includeLive ? ["Release Readiness", "tools/qa-release-readiness.mjs"] : null
].filter(Boolean);

const failures = [];
const warnings = [];
const blockers = [];
const passed = [];

function extractBlockers(output, label) {
  const lines = output.split("\n").map((line) => line.trim()).filter(Boolean);
  let collecting = false;
  for (const line of lines) {
    if (/blockers/i.test(line) && !/^Run with/i.test(line)) {
      collecting = true;
      continue;
    }
    if (collecting && /^(Next setup commands|Expected Firebase Hosting DNS|Run with|Provider readiness checked|Release readiness checked|Domain readiness checked|Checks with warnings|Pilot readiness)/i.test(line)) {
      collecting = false;
      continue;
    }
    if (collecting && /^(BLOCK|- )/i.test(line)) {
      blockers.push(`${label}: ${line.replace(/^(BLOCK|-)\s*/i, "")}`);
      continue;
    }
    if (collecting && /^(PASS|WARN|Provider readiness warnings|Release readiness warnings|Domain readiness warnings)/i.test(line)) {
      collecting = false;
    }
  }
}

async function runCheck(label, script) {
  try {
    const { stdout, stderr } = await execFileAsync(node, [script], {
      maxBuffer: 1024 * 1024 * 8,
      env: process.env
    });
    const output = `${stdout || ""}${stderr || ""}`;
    passed.push(label);
    extractBlockers(output, label);
    if (/warnings?:/i.test(output)) warnings.push(label);
    console.log(`PASS ${label}`);
    return output;
  } catch (error) {
    const output = `${error.stdout || ""}${error.stderr || ""}`;
    failures.push(`${label}: ${error.message}`);
    extractBlockers(output, label);
    console.log(`FAIL ${label}`);
    return output;
  }
}

console.log("Lux Veritas pilot readiness QA");
console.log(`Browser-flow coverage: ${includeBrowser ? "enabled" : "disabled"} (set LUX_PILOT_BROWSER=1 to enable)`);
console.log(`Live readiness coverage: ${includeLive ? "enabled" : "disabled"} (set LUX_PILOT_LIVE=1 to enable)`);
console.log("Preparing fresh static and hosting artifacts before QA.");

for (const [label, script] of [...setupChecks, ...checks]) {
  await runCheck(label, script);
}

if (blockers.length) {
  console.log("");
  console.log("Launch blockers still present:");
  for (const blocker of blockers) console.log(`- ${blocker}`);
}

if (warnings.length) {
  console.log("");
  console.log(`Checks with warnings: ${warnings.join(", ")}`);
}

if (failures.length) {
  console.error("");
  console.error(`Pilot readiness failed with ${failures.length} code/QA failure(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

if (strict && blockers.length) {
  console.error("");
  console.error(`Pilot readiness strict mode failed with ${blockers.length} launch blocker(s).`);
  process.exit(1);
}

console.log("");
console.log(`Pilot readiness checked: ${passed.length} check(s) passed, ${warnings.length} warning group(s), ${blockers.length} launch blocker(s).`);
if (blockers.length && !strict) {
  console.log("Run with LUX_PILOT_STRICT=1 when external launch blockers must fail this command.");
}
