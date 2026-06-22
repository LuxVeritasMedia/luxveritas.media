import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const strict = process.env.LUX_FUNCTIONS_DEPLOY_STRICT === "1";
const repo = process.env.LUX_GITHUB_REPO || "LuxVeritasMedia/luxveritas.media";
const workflow = process.env.LUX_FUNCTIONS_WORKFLOW || "firebase-functions-manual.yml";
const project = process.env.LUX_FIREBASE_PROJECT || "lux-veritas-media";
const runtimeServiceAccount = "lux-veritas-media@appspot.gserviceaccount.com";
const expectedIamPermission = "iam.serviceAccounts.ActAs";
const warnings = [];
const blockers = [];
const passed = [];

function pass(message) {
  passed.push(message);
  console.log(`PASS ${message}`);
}

function warn(message) {
  warnings.push(message);
  console.log(`WARN ${message}`);
}

function block(message) {
  blockers.push(message);
  if (strict) console.log(`BLOCK ${message}`);
  else console.log(`WARN ${message}`);
}

function compact(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 320);
}

async function run(command, args = [], options = {}) {
  try {
    const result = await execFileAsync(command, args, {
      timeout: options.timeout || 20000,
      maxBuffer: options.maxBuffer || 1024 * 1024 * 8
    });
    return {
      ok: true,
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim()
    };
  } catch (error) {
    return {
      ok: false,
      stdout: String(error.stdout || "").trim(),
      stderr: String(error.stderr || "").trim(),
      message: error.message,
      code: error.code
    };
  }
}

async function findGh() {
  const available = [];
  for (const command of [".codex-tools/gh-local/bin/gh", "gh"]) {
    const result = await run(command, ["--version"], { timeout: 8000 });
    if (result.ok) available.push(command);
  }
  for (const command of available) {
    const auth = await run(command, ["auth", "status"], { timeout: 12000 });
    if (auth.ok) return command;
  }
  if (available.length) return available[0];
  return "";
}

function parseJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function fetchJson(url) {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json, application/vnd.github+json",
        "Cache-Control": "no-cache",
        "User-Agent": "luxveritas-functions-deploy-readiness"
      }
    });
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
    return response.json();
  } catch (error) {
    const curl = await run("curl", [
      "-fsS",
      "-H",
      "Accept: application/json, application/vnd.github+json",
      "-H",
      "Cache-Control: no-cache",
      "-H",
      "User-Agent: luxveritas-functions-deploy-readiness",
      url
    ], { timeout: 15000, maxBuffer: 1024 * 1024 * 4 });
    if (!curl.ok) throw new Error(compact(curl.stderr || curl.stdout || curl.message || error?.message));
    return JSON.parse(curl.stdout);
  }
}

console.log("Lux Veritas Functions deploy readiness");

const workflowSource = await readFile(".github/workflows/firebase-functions-manual.yml", "utf8");
for (const marker of [
  "workflow_dispatch:",
  "deploy --only functions",
  "google-github-actions/auth@v3",
  "GCP_WORKLOAD_IDENTITY_PROVIDER",
  "GCP_SERVICE_ACCOUNT",
  "--no-invoker-iam-check"
]) {
  if (workflowSource.includes(marker)) pass(`Functions workflow contains ${marker}`);
  else block(`Functions workflow is missing ${marker}`);
}

const functionsList = await run("firebase", ["functions:list", "--project", project, "--json"], { timeout: 30000, maxBuffer: 1024 * 1024 * 4 });
const functionsListText = `${functionsList.stdout}\n${functionsList.stderr}`;
const functionsJson = parseJson(functionsList.stdout, null);
const functionIds = Array.isArray(functionsJson?.result) ? functionsJson.result.map((item) => item.id) : [];
if (functionsList.ok && functionIds.includes("submitForm") && functionIds.includes("reportActivity")) {
  pass("Firebase CLI can read deployed Functions for submitForm and reportActivity.");
} else if (functionsList.ok && /submitForm/i.test(functionsListText) && /reportActivity/i.test(functionsListText)) {
  pass("Firebase CLI can read deployed Functions for submitForm and reportActivity.");
} else if (/encountered an error|firepit-log/i.test(functionsListText)) {
  warn("Firebase Functions list hit the Firebase CLI non-interactive firepit bug; use shell `firebase functions:list --project lux-veritas-media --json` when direct function inventory proof is needed.");
} else if (functionsList.ok) {
  warn("Firebase CLI responded, but expected deployed Functions were not visible in this non-interactive check.");
} else {
  warn(`Firebase Functions list unavailable from this machine: ${compact(functionsList.stderr || functionsList.stdout || functionsList.message)}`);
}

let latestManualRun = null;
try {
  const runs = await fetchJson(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/runs?per_page=10&branch=main`);
  latestManualRun = (Array.isArray(runs.workflow_runs) ? runs.workflow_runs : []).find((run) => run.event === "workflow_dispatch") || null;
  if (!latestManualRun) {
    warn("No manual Functions deploy run found through the GitHub Actions API.");
  } else if (latestManualRun.status === "completed" && latestManualRun.conclusion === "success") {
    pass(`Latest manual Functions deploy completed successfully: ${latestManualRun.html_url}`);
  } else if (latestManualRun.status === "queued" || latestManualRun.status === "in_progress") {
    warn(`Latest manual Functions deploy is ${latestManualRun.status}: ${latestManualRun.html_url}`);
  }
} catch (error) {
  warn(`Could not inspect GitHub Functions workflow status: ${compact(error?.message || String(error))}`);
}

const gh = await findGh();
if (!gh) {
  warn("GitHub CLI is unavailable; install or authenticate gh to inspect the latest manual Functions deploy run.");
} else {
  pass("GitHub CLI is available for Functions workflow inspection.");
  const auth = await run(gh, ["auth", "status"], { timeout: 15000 });
  if (auth.ok) pass("GitHub CLI is authenticated.");
  else warn(`GitHub CLI auth is unavailable: ${compact(auth.stderr || auth.stdout || auth.message)}`);

  if (auth.ok && latestManualRun && latestManualRun.status === "completed" && latestManualRun.conclusion !== "success") {
    const log = await run(gh, [
      "run",
      "view",
      String(latestManualRun.id),
      "--repo",
      repo,
      "--log-failed"
    ], { timeout: 30000, maxBuffer: 1024 * 1024 * 12 });
    const logText = `${log.stdout}\n${log.stderr}`;
    if (new RegExp(expectedIamPermission.replace(".", "\\."), "i").test(logText) && logText.includes(runtimeServiceAccount)) {
      block(`Latest manual Functions deploy is blocked by missing ${expectedIamPermission} / Service Account User on ${runtimeServiceAccount}. Use docs/functions-deploy-iam-repair.md to grant that role to the GitHub deploy service account, then rerun the manual Functions workflow.`);
    } else {
      block(`Latest manual Functions deploy is ${latestManualRun.status}/${latestManualRun.conclusion || "none"}: ${latestManualRun.html_url}`);
    }
  }
}

if (latestManualRun && latestManualRun.status === "completed" && latestManualRun.conclusion !== "success") {
  const alreadyRecorded = blockers.some((message) => message.includes("Latest manual Functions deploy"));
  if (!alreadyRecorded) {
    block(`Latest manual Functions deploy failed and needs operator review: ${latestManualRun.html_url}. Known repair path is docs/functions-deploy-iam-repair.md when logs report missing ${expectedIamPermission} on ${runtimeServiceAccount}.`);
  }
}

console.log("");
console.log(`Functions deploy readiness checked: ${passed.length} passed, ${warnings.length} warning(s), ${blockers.length} deploy blocker(s).`);
if (blockers.length) {
  console.log(`Run with LUX_FUNCTIONS_DEPLOY_STRICT=1 when manual Functions deploy blockers should fail this command.`);
}
if (strict && blockers.length) process.exit(1);
