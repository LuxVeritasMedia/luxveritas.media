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

async function gitValue(args) {
  const { stdout } = await execFileAsync("git", args, { timeout: 10000 });
  return stdout.trim();
}

async function fetchJson(url) {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json, application/vnd.github+json",
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
        "User-Agent: luxveritas-deploy-status",
        url
      ], { timeout: 15000, maxBuffer: 1024 * 1024 * 2 });
      return JSON.parse(stdout);
    } catch {
      throw error;
    }
  }
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
  warn(`could not read GitHub Actions status: ${error?.message || String(error)}`);
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
