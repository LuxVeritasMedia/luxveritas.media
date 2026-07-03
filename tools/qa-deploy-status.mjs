import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const strict = process.env.LUX_DEPLOY_STATUS_STRICT === "1";
const repo = process.env.LUX_GITHUB_REPO || "LuxVeritasMedia/luxveritas.media";
const workflow = process.env.LUX_GITHUB_WORKFLOW || "firebase-hosting-live.yml";
const baseUrl = (process.env.LUX_LIVE_URL || "https://luxveritas.media").replace(/\/$/, "");
const maxActiveRunAgeMinutes = Number(process.env.LUX_DEPLOY_ACTIVE_MAX_MINUTES || "30");
const issues = [];
const warnings = [];
const passed = [];

function pass(message) {
  passed.push(message);
  console.log(`PASS ${message}`);
}

function warn(message) {
  warnings.push(message);
  console.log(`WARN ${message}`);
}

function issue(message) {
  issues.push(message);
  console.log(`BLOCK ${message}`);
}

function compact(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 320);
}

async function run(command, args = [], options = {}) {
  try {
    const result = await execFileAsync(command, args, {
      timeout: options.timeout || 20000,
      maxBuffer: options.maxBuffer || 1024 * 1024 * 4
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

async function gitValue(args) {
  const { stdout } = await execFileAsync("git", args, { timeout: 10000 });
  return stdout.trim();
}

async function fetchJson(url) {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json, application/vnd.github+json",
        "Cache-Control": "no-cache",
        "User-Agent": "luxveritas-deploy-status"
      }
    });
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
    return response.json();
  } catch (error) {
    try {
      const { stdout } = await execFileAsync("curl", [
        "-fsS",
        "-H",
        "Accept: application/json, application/vnd.github+json",
        "-H",
        "Cache-Control: no-cache",
        "-H",
        "User-Agent: luxveritas-deploy-status",
        url
      ], { timeout: 15000, maxBuffer: 1024 * 1024 * 2 });
      return JSON.parse(stdout);
    } catch {
      throw error;
    }
  }
}

async function latestWorkflowRunFromGh() {
  const gh = await findGh();
  if (!gh) return { run: null, warning: "GitHub CLI is unavailable for deploy-status fallback." };
  const result = await run(gh, [
    "run",
    "list",
    "--repo",
    repo,
    "--workflow",
    workflow,
    "--branch",
    "main",
    "--limit",
    "1",
    "--json",
    "databaseId,status,conclusion,headSha,createdAt,updatedAt,url"
  ], { timeout: 20000, maxBuffer: 1024 * 1024 * 2 });
  if (!result.ok) {
    return { run: null, warning: `GitHub CLI deploy-status fallback failed: ${compact(result.stderr || result.stdout || result.message)}` };
  }
  let parsed = [];
  try {
    parsed = JSON.parse(result.stdout || "[]");
  } catch {
    return { run: null, warning: "GitHub CLI deploy-status fallback returned non-JSON output." };
  }
  const runItem = Array.isArray(parsed) ? parsed[0] : null;
  if (!runItem) return { run: null, warning: "GitHub CLI deploy-status fallback found no hosting workflow runs." };
  return {
    run: {
      id: runItem.databaseId,
      run_number: runItem.databaseId,
      status: runItem.status,
      conclusion: runItem.conclusion,
      head_sha: runItem.headSha,
      html_url: runItem.url,
      created_at: runItem.createdAt,
      updated_at: runItem.updatedAt
    },
    warning: ""
  };
}

function assetVersionFromBuildScript(buildScript) {
  return buildScript.match(/const assetVersion = "([^"]+)"/)?.[1] || "";
}

function runSummary(run) {
  if (!run) return "none";
  return `${run.status}${run.conclusion ? `/${run.conclusion}` : ""} #${run.run_number || "?"} ${String(run.head_sha || "").slice(0, 7)}`;
}

function minutesSince(value) {
  const time = Date.parse(value || "");
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.round((Date.now() - time) / 60000));
}

console.log("Lux Veritas deploy status");

const [localSha, remoteSha, buildScript] = await Promise.all([
  gitValue(["rev-parse", "HEAD"]),
  gitValue(["rev-parse", "origin/main"]),
  readFile("tools/build-static.mjs", "utf8")
]);
const expectedAssetVersion = assetVersionFromBuildScript(buildScript);

if (localSha === remoteSha) {
  pass(`local HEAD matches origin/main (${localSha.slice(0, 7)}).`);
} else {
  issue(`local HEAD ${localSha.slice(0, 7)} does not match origin/main ${remoteSha.slice(0, 7)}.`);
}

if (expectedAssetVersion) {
  pass(`local expected asset version is ${expectedAssetVersion}.`);
} else {
  issue("tools/build-static.mjs does not expose assetVersion.");
}

let latestRun = null;
try {
  const runs = await fetchJson(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/runs?per_page=1&branch=main`);
  latestRun = Array.isArray(runs.workflow_runs) ? runs.workflow_runs[0] : null;
  if (latestRun?.url) {
    try {
      const refreshedRun = await fetchJson(latestRun.url);
      if (refreshedRun?.id === latestRun.id) latestRun = refreshedRun;
    } catch {
      // The workflow list response is still usable when the direct run lookup is unavailable.
    }
  }
  if (latestRun) {
    const runSha = latestRun.head_sha || "";
    const runUrl = latestRun.html_url || "";
    if (runSha === remoteSha) {
      pass(`latest hosting workflow targets origin/main (${runSummary(latestRun)}).`);
    } else {
      issue(`latest hosting workflow targets ${runSha.slice(0, 7) || "unknown"}, not origin/main ${remoteSha.slice(0, 7)}.`);
    }

    if (latestRun.status === "completed" && latestRun.conclusion === "success") {
      const completedAge = minutesSince(latestRun.updated_at || latestRun.run_started_at || latestRun.created_at);
      pass(`latest hosting workflow completed successfully${completedAge === null ? "" : ` ${completedAge} minute(s) ago`}: ${runUrl}`);
    } else if (latestRun.status === "in_progress" || latestRun.status === "queued") {
      const activeAge = minutesSince(latestRun.run_started_at || latestRun.created_at);
      const ageText = activeAge === null ? "unknown age" : `${activeAge} minute(s) old`;
      if (activeAge !== null && activeAge > maxActiveRunAgeMinutes) {
        issue(`latest hosting workflow is still ${latestRun.status} after ${ageText} (limit ${maxActiveRunAgeMinutes}): ${runUrl}`);
      } else {
        warn(`latest hosting workflow is still ${latestRun.status} (${ageText}): ${runUrl}`);
      }
    } else {
      issue(`latest hosting workflow is ${latestRun.status}/${latestRun.conclusion || "none"}: ${runUrl}`);
    }
  } else {
    issue(`no hosting workflow runs found for ${repo}/${workflow}.`);
  }
} catch (error) {
  const fallback = await latestWorkflowRunFromGh();
  if (fallback.run) {
    latestRun = fallback.run;
    const runSha = latestRun.head_sha || "";
    const runUrl = latestRun.html_url || "";
    if (runSha === remoteSha) {
      pass(`latest hosting workflow targets origin/main (${runSummary(latestRun)}) via GitHub CLI fallback.`);
    } else {
      issue(`latest hosting workflow targets ${runSha.slice(0, 7) || "unknown"}, not origin/main ${remoteSha.slice(0, 7)}.`);
    }

    if (latestRun.status === "completed" && latestRun.conclusion === "success") {
      const completedAge = minutesSince(latestRun.updated_at || latestRun.created_at);
      pass(`latest hosting workflow completed successfully${completedAge === null ? "" : ` ${completedAge} minute(s) ago`}: ${runUrl}`);
    } else if (latestRun.status === "in_progress" || latestRun.status === "queued") {
      const activeAge = minutesSince(latestRun.created_at);
      const ageText = activeAge === null ? "unknown age" : `${activeAge} minute(s) old`;
      if (activeAge !== null && activeAge > maxActiveRunAgeMinutes) {
        issue(`latest hosting workflow is still ${latestRun.status} after ${ageText} (limit ${maxActiveRunAgeMinutes}): ${runUrl}`);
      } else {
        warn(`latest hosting workflow is still ${latestRun.status} (${ageText}): ${runUrl}`);
      }
    } else {
      issue(`latest hosting workflow is ${latestRun.status}/${latestRun.conclusion || "none"}: ${runUrl}`);
    }
  } else {
    warn(`could not read GitHub Actions status: ${error?.message || String(error)}${fallback.warning ? `; ${fallback.warning}` : ""}`);
  }
}

try {
  const liveManifest = await fetchJson(`${baseUrl}/data/lux-build-manifest.json`);
  const liveVersion = liveManifest.assetVersion || liveManifest.version || "";
  if (liveVersion === expectedAssetVersion) {
    pass(`live build manifest is current (${liveVersion}).`);
  } else {
    issue(`live build manifest is ${liveVersion || "missing"}, expected ${expectedAssetVersion || "unknown"}.`);
  }
  if (liveManifest.appScript === `app.js?v=${expectedAssetVersion}`) {
    pass("live build manifest appScript matches expected asset version.");
  } else {
    issue(`live build manifest appScript is ${liveManifest.appScript || "missing"}.`);
  }
} catch (error) {
  warn(`could not read live build manifest from this environment: ${error?.message || String(error)}`);
}

console.log("");
console.log(`Deploy status checked: ${passed.length} passed, ${warnings.length} warning(s), ${issues.length} blocker(s).`);
if (issues.length && strict) process.exit(1);
if (issues.length && !strict) {
  console.log("Run with LUX_DEPLOY_STATUS_STRICT=1 when stale deploys must fail this command.");
}
