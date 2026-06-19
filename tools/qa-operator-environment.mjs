import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const strict = process.env.LUX_OPERATOR_ENV_STRICT === "1";
const warnings = [];
const issues = [];
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

async function exists(path) {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function run(command, args = [], options = {}) {
  try {
    const result = await execFileAsync(command, args, {
      timeout: options.timeout || 12000,
      maxBuffer: 1024 * 1024 * 2
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

function compactError(result) {
  const text = [result.stderr, result.stdout, result.message].filter(Boolean).join(" ");
  return text.replace(/\s+/g, " ").slice(0, 260) || "unavailable";
}

console.log("Lux Veritas operator environment QA");

for (const file of [
  "AGENTS.md",
  "firebase.json",
  "tools/build-static.mjs",
  "tools/qa-final-release-gate.mjs",
  "docs/final-launch-runbook.md",
  "data/lux-build-manifest.json"
]) {
  if (await exists(file)) pass(`${file} is readable.`);
  else issue(`${file} is missing or unreadable.`);
}

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor >= 22) pass(`Node.js ${process.versions.node} satisfies the local launch runtime.`);
else warn(`Node.js ${process.versions.node} is below the GitHub/Firebase workflow runtime; use Node 22 for launch checks.`);

const repoRoot = await run("git", ["rev-parse", "--show-toplevel"]);
if (repoRoot.ok && /LuxVeritas-website$/.test(repoRoot.stdout)) {
  pass(`git repository root is ${repoRoot.stdout}.`);
} else if (repoRoot.ok) {
  issue(`git repository root is ${repoRoot.stdout}, expected LuxVeritas-website.`);
} else {
  issue(`git repository unavailable: ${compactError(repoRoot)}`);
}

const branch = await run("git", ["branch", "--show-current"]);
if (branch.ok && branch.stdout === "main") pass("current branch is main.");
else if (branch.ok) warn(`current branch is ${branch.stdout || "detached"}, not main.`);
else warn(`could not read current git branch: ${compactError(branch)}`);

const status = await run("git", ["status", "--short"]);
if (status.ok && !status.stdout) pass("working tree is clean.");
else if (status.ok) warn("working tree has local changes; commit or intentionally carry them before final launch.");
else warn(`could not read git status: ${compactError(status)}`);

const remote = await run("git", ["remote", "get-url", "origin"]);
if (remote.ok && /LuxVeritasMedia\/luxveritas\.media(\.git)?$/.test(remote.stdout)) {
  pass("origin remote targets LuxVeritasMedia/luxveritas.media.");
} else if (remote.ok) {
  issue(`origin remote is ${remote.stdout || "missing"}, expected LuxVeritasMedia/luxveritas.media.`);
} else {
  issue(`could not read origin remote: ${compactError(remote)}`);
}

const buildManifestRaw = await readFile("data/lux-build-manifest.json", "utf8");
const buildManifest = JSON.parse(buildManifestRaw);
if (buildManifest.assetVersion) pass(`local build manifest asset version is ${buildManifest.assetVersion}.`);
else issue("local build manifest is missing assetVersion.");

const firebaseVersion = await run("firebase", ["--version"]);
if (firebaseVersion.ok) pass(`Firebase CLI is available (${firebaseVersion.stdout}).`);
else warn(`Firebase CLI is not available or not on PATH: ${compactError(firebaseVersion)}`);

const firebaseLogin = await run("firebase", ["login:list"], { timeout: 15000 });
if (firebaseLogin.ok && /info@luxveritas\.media/i.test(firebaseLogin.stdout)) {
  pass("Firebase CLI lists info@luxveritas.media as logged in.");
} else if (firebaseLogin.ok && firebaseLogin.stdout) {
  issue(`Firebase CLI is logged in, but not as info@luxveritas.media: ${firebaseLogin.stdout.replace(/\n/g, "; ")}`);
} else {
  issue(`Firebase CLI login state needs attention: ${compactError(firebaseLogin)}`);
}

const firebaseProjects = await run("firebase", ["projects:list", "--json"], { timeout: 20000 });
if (firebaseProjects.ok && /lux-veritas-media/.test(firebaseProjects.stdout)) {
  pass("Firebase CLI can read project metadata for lux-veritas-media.");
} else if (firebaseProjects.ok) {
  issue("Firebase CLI responded, but lux-veritas-media was not visible in projects:list.");
} else if (/reauth|auth|login|expired|credential/i.test(compactError(firebaseProjects))) {
  issue("Firebase CLI credentials need interactive refresh; run firebase login --reauth in Terminal.");
} else {
  warn(`Firebase project metadata check unavailable: ${compactError(firebaseProjects)}`);
}

const ghVersion = await run("gh", ["--version"]);
if (ghVersion.ok) pass(`GitHub CLI is available (${ghVersion.stdout.split("\n")[0]}).`);
else warn("GitHub CLI `gh` is not available. This is optional because deploy status can use GitHub API reads, but install it to trigger manual workflows locally.");

const port = await run("lsof", ["-ti", ":4173"]);
if (port.ok && port.stdout) warn(`localhost:4173 is already in use by process ${port.stdout.split(/\s+/)[0]}.`);
else pass("localhost:4173 is free for the documented static preview server.");

console.log("");
console.log(`Operator environment checked: ${passed.length} passed, ${warnings.length} warning(s), ${issues.length} blocker(s).`);
if (warnings.length) {
  console.log("Warnings should be resolved before final launch-day operations when they affect the command you need to run.");
}
if (issues.length && strict) process.exit(1);
if (issues.length && !strict) {
  console.log("Run with LUX_OPERATOR_ENV_STRICT=1 when operator-environment blockers must fail this command.");
}
