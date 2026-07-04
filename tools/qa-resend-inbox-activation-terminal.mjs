import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const node = process.execPath;
const helperPath = "tools/run-resend-inbox-activation-terminal.mjs";
const issues = [];
const secretPattern = /\bre_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}|REPORT_OPERATOR_TOKEN=.*[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{16,}|FORM_INTEGRATION_URL=https:\/\/\S+|[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/i;

function issue(message) {
  issues.push(message);
}

function requireMarkers(label, text, markers) {
  for (const marker of markers) {
    if (!text.includes(marker)) issue(`${label}: missing ${marker}`);
  }
}

function stripKnownPlaceholders(text) {
  return String(text)
    .replace(/re_\.\.\./g, "x")
    .replace(/paste-private-operator-token-here/g, "x")
    .replace(/LUX_REPORT_TOKEN=[^\n]*/g, "LUX_REPORT_TOKEN=x")
    .replace(/REPORT_OPERATOR_TOKEN=[^\n]*/g, "REPORT_OPERATOR_TOKEN=x");
}

const [helper, deploymentDoc, runbook] = await Promise.all([
  readFile(helperPath, "utf8"),
  readFile("docs/deployment.md", "utf8"),
  readFile("docs/final-launch-runbook.md", "utf8")
]);

requireMarkers(helperPath, helper, [
  "readHidden",
  "setEcho(false)",
  "setEcho(true)",
  "Paste approved Resend API key (input hidden):",
  "LUX_INBOX_ACTIVATION_LOG",
  "writeFileSync(logPath",
  "appendFileSync(logPath",
  "stripControls",
  "--dry-run",
  "--write-test",
  "--skip-deploy",
  "process.chdir(repoRoot)",
  "tools/qa-resend-domain-readiness.mjs",
  "tools/activate-inbox-delivery.mjs",
  "tools/qa-provider-readiness.mjs",
  "tools/qa-release-readiness.mjs",
  "LUX_INBOX_ACTIVATION_SKIP_DEPLOY",
  "LUX_INBOX_ACTIVATION_WRITE_TEST"
]);

requireMarkers("docs/deployment.md", deploymentDoc, [
  "node tools/run-resend-inbox-activation-terminal.mjs",
  "hidden input",
  "keeps the key out of shell history",
  "/tmp/lux-resend-activation.log",
  "activate-inbox-delivery.mjs"
]);

requireMarkers("docs/final-launch-runbook.md", runbook, [
  "node tools/run-resend-inbox-activation-terminal.mjs",
  "keeps the Resend key out of shell history",
  "/tmp/lux-resend-activation.log",
  "LUX_RESEND_API_KEY=\"re_...\" node tools/activate-inbox-delivery.mjs"
]);

if (
  secretPattern.test(stripKnownPlaceholders(helper))
  || secretPattern.test(stripKnownPlaceholders(deploymentDoc))
  || secretPattern.test(stripKnownPlaceholders(runbook))
) {
  issue("Resend activation runner or docs contain secret-shaped data");
}

try {
  await execFileAsync(node, ["--check", helperPath], {
    timeout: 30000,
    maxBuffer: 1024 * 1024
  });
} catch (error) {
  issue(`${helperPath}: syntax check failed: ${error.stderr || error.message}`);
}

const tempDir = await mkdtemp(join(tmpdir(), "lux-resend-runner-qa-"));
const logPath = join(tempDir, "activation.log");
try {
  const { stdout, stderr } = await execFileAsync(node, [helperPath, "--dry-run", "--write-test", "--skip-deploy"], {
    env: { ...process.env, LUX_INBOX_ACTIVATION_LOG: logPath },
    timeout: 30000,
    maxBuffer: 1024 * 1024
  });
  const output = `${stdout || ""}${stderr || ""}`;
  const transcript = await readFile(logPath, "utf8");
  requireMarkers("dry-run output", output, [
    "Lux Veritas Resend inbox activation",
    "Target sender: forms@luxveritas.media",
    "Target Firebase project: lux-veritas-media",
    "Mode: skip deploy",
    "Mode: live write test enabled",
    "Dry run passed. Live mode will prompt for the Resend key without echoing it",
    "node tools/qa-resend-domain-readiness.mjs",
    "node tools/activate-inbox-delivery.mjs",
    "node tools/qa-provider-readiness.mjs",
    "node tools/qa-release-readiness.mjs"
  ]);
  requireMarkers("dry-run transcript", transcript, [
    "Lux Veritas Resend inbox activation transcript",
    "Dry run passed",
    "Live inbox write QA is enabled for this planned run."
  ]);
  if (secretPattern.test(stripKnownPlaceholders(output)) || secretPattern.test(stripKnownPlaceholders(transcript))) {
    issue("Resend activation dry-run output contains secret-shaped data");
  }
} catch (error) {
  issue(`Resend activation runner dry-run failed: ${error.stderr || error.stdout || error.message}`);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

if (issues.length) {
  console.error(`Resend inbox activation terminal QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log("Resend inbox activation terminal QA passed.");
