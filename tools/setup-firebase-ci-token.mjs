import { spawn } from "node:child_process";

const repo = process.env.LUX_GITHUB_REPO || "LuxVeritasMedia/luxveritas.media";
const project = process.env.LUX_FIREBASE_PROJECT || "lux-veritas-media";
const secretName = "FIREBASE_CI_TOKEN";
const ghBin = process.env.LUX_GH_BIN || ".codex-tools/gh-local/bin/gh";
const dryRun = process.env.LUX_FIREBASE_CI_SETUP_DRY_RUN === "1";
const skipPreflight = process.env.LUX_FIREBASE_CI_SETUP_SKIP_PREFLIGHT === "1";
const skipWorkflow = process.env.LUX_FIREBASE_CI_SETUP_SKIP_WORKFLOW === "1";
const watchWorkflow = process.env.LUX_FIREBASE_CI_SETUP_WATCH !== "0";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: { ...process.env, ...(options.env || {}) },
      stdio: options.input == null ? "inherit" : ["pipe", "inherit", "inherit"]
    });

    if (options.input != null) {
      child.stdin.end(options.input);
    }

    child.on("exit", (code) => {
      if (code) reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
      else resolve();
    });
  });
}

function capture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: { ...process.env, ...(options.env || {}) },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("exit", (code) => {
      if (code) reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}\n${stderr}`));
      else resolve({ stdout, stderr });
    });
  });
}

async function readPipedToken() {
  if (process.stdin.isTTY) return "";
  let body = "";
  for await (const chunk of process.stdin) {
    body += chunk;
  }
  return body.trim();
}

function validateToken(token) {
  if (!token) return;
  if (/\s/.test(token)) {
    console.error("FIREBASE_CI_TOKEN must be a single token with no whitespace.");
    process.exit(1);
  }
  if (token.length < 30) {
    console.error("FIREBASE_CI_TOKEN is too short to look like a Firebase CLI token.");
    process.exit(1);
  }
  if (/^4\//.test(token)) {
    console.error("This looks like a one-time OAuth authorization code, not a Firebase CLI CI token. Run firebase login:ci and use the token it prints after authentication.");
    process.exit(1);
  }
  if (/^ya29\./i.test(token)) {
    console.error("This looks like a Google access token, not a Firebase CLI CI token. Use firebase login:ci instead.");
    process.exit(1);
  }
}

async function secretExists() {
  const { stdout } = await capture(ghBin, [
    "secret",
    "list",
    "--repo",
    repo,
    "--app",
    "actions"
  ]);
  return stdout.split("\n").some((line) => line.split(/\s+/)[0] === secretName);
}

async function latestHostingRunId() {
  const { stdout } = await capture(ghBin, [
    "run",
    "list",
    "--workflow",
    "firebase-hosting-live.yml",
    "--repo",
    repo,
    "--limit",
    "1",
    "--json",
    "databaseId,status,conclusion,displayTitle,createdAt"
  ]);
  const [run] = JSON.parse(stdout || "[]");
  return run?.databaseId ? String(run.databaseId) : "";
}

const envToken = String(process.env.FIREBASE_CI_TOKEN || "").trim();
const pipedToken = envToken ? "" : await readPipedToken();
const token = envToken || pipedToken;
const source = envToken ? "environment" : pipedToken ? "stdin" : "interactive GitHub CLI prompt";

console.log(`Firebase CI token setup for ${repo} / ${project} using ${source}.`);

if (dryRun) {
  console.log("Dry run passed.");
  console.log(`Would run gh secret set ${secretName} for ${repo}.`);
  console.log(`Would set GitHub Actions secret ${secretName}.`);
  console.log("Would run deploy auth preflight when a token is provided through FIREBASE_CI_TOKEN or stdin.");
  console.log("Would trigger firebase-hosting-live.yml unless LUX_FIREBASE_CI_SETUP_SKIP_WORKFLOW=1.");
  process.exit(0);
}

validateToken(token);

if (token && !skipPreflight) {
  await run(process.execPath, ["tools/qa-firebase-deploy-auth.mjs"], {
    env: {
      FIREBASE_CI_TOKEN: token,
      LUX_FIREBASE_PROJECT: project
    }
  });
}

if (token) {
  await run(ghBin, ["secret", "set", secretName, "--repo", repo, "--app", "actions"], {
    input: `${token}\n`
  });
} else {
  console.log("No token was provided through FIREBASE_CI_TOKEN or stdin.");
  console.log("Opening GitHub CLI's secret prompt. Paste the Firebase CLI token there; it will not be written to the repo.");
  await run(ghBin, ["secret", "set", secretName, "--repo", repo, "--app", "actions"]);
}

if (!(await secretExists())) {
  console.error(`${secretName} was not visible in GitHub Actions secrets after setup.`);
  process.exit(1);
}

console.log(`${secretName} is present in GitHub Actions secrets for ${repo}.`);

if (skipWorkflow) {
  console.log("Skipped Hosting workflow dispatch.");
  process.exit(0);
}

await run(ghBin, [
  "workflow",
  "run",
  "firebase-hosting-live.yml",
  "--repo",
  repo,
  "--ref",
  "main"
]);

await new Promise((resolve) => setTimeout(resolve, 5000));
const runId = await latestHostingRunId();
if (!runId) {
  console.log("Hosting workflow dispatched; run ID was not available yet. Check GitHub Actions.");
  process.exit(0);
}

console.log(`Hosting workflow dispatched: ${runId}`);

if (watchWorkflow) {
  await run(ghBin, ["run", "watch", runId, "--repo", repo, "--exit-status"]);
}
