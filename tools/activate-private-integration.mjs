import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const project = process.env.LUX_FIREBASE_PROJECT || "lux-veritas-media";
const url = process.env.LUX_FORM_INTEGRATION_URL || "";
const signingSecret = process.env.LUX_FORM_INTEGRATION_SIGNING_SECRET || "";
const target = (process.env.LUX_FORM_INTEGRATION_TARGET || "").trim().toLowerCase();
const allowFuture = process.env.LUX_PRIVATE_INTEGRATION_ALLOW_FUTURE === "1";
const dryRun = process.env.LUX_PRIVATE_INTEGRATION_ACTIVATION_DRY_RUN === "1";
const skipDeploy = process.env.LUX_PRIVATE_INTEGRATION_SKIP_DEPLOY === "1";
const functionTarget = "functions:submitForm,functions:reportActivity,functions:receivePrivateHandoff";

function usage(exitCode = 1) {
  console.error("Set approved private integration values, then run:");
  console.error("  LUX_FORM_INTEGRATION_URL='https://...' LUX_FORM_INTEGRATION_SIGNING_SECRET='approved-shared-secret' LUX_FORM_INTEGRATION_TARGET='firebase_handoff' node tools/activate-private-integration.mjs");
  console.error("");
  console.error("Use LUX_PRIVATE_INTEGRATION_ACTIVATION_DRY_RUN=1 to validate without writing secrets or deploying.");
  console.error("Use LUX_PRIVATE_INTEGRATION_ALLOW_FUTURE=1 only after human approval for future profiles like ghl_crm, google_workspace, or codex_ops.");
  process.exit(exitCode);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: { ...process.env, ...(options.env || {}) }
    });
    child.on("exit", (code) => {
      if (code) reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
      else resolve();
    });
  });
}

const registry = JSON.parse(await readFile("docs/private-integration-profiles.json", "utf8"));
const profiles = Array.isArray(registry.profiles) ? registry.profiles : [];
const profile = profiles.find((item) => item.targetSecretValue === target);

if (!url || !signingSecret || !target) usage();
if (!/^https:\/\//i.test(url)) {
  console.error("LUX_FORM_INTEGRATION_URL must be HTTPS.");
  process.exit(1);
}
if (!/^[a-z0-9_-]{3,80}$/.test(target)) {
  console.error("LUX_FORM_INTEGRATION_TARGET must be a short approved profile label.");
  process.exit(1);
}
if (!profile) {
  console.error(`LUX_FORM_INTEGRATION_TARGET '${target}' is not in docs/private-integration-profiles.json.`);
  console.error(`Approved labels: ${profiles.map((item) => item.targetSecretValue).join(", ")}`);
  process.exit(1);
}
if (profile.status === "future" && !allowFuture) {
  console.error(`${target} is marked future. Set LUX_PRIVATE_INTEGRATION_ALLOW_FUTURE=1 only after human approval.`);
  process.exit(1);
}

if (dryRun) {
  console.log(`Dry run passed for private integration profile ${target} (${profile.label}) in project ${project}.`);
  console.log(`Would set FORM_INTEGRATION_URL, FORM_INTEGRATION_SIGNING_SECRET, FORM_INTEGRATION_TARGET, deploy ${functionTarget}, then run provider readiness.`);
  process.exit(0);
}

await run(process.execPath, ["tools/setup-private-integration-secret.mjs"], {
  env: {
    LUX_FIREBASE_PROJECT: project,
    LUX_FORM_INTEGRATION_URL: url,
    LUX_FORM_INTEGRATION_SIGNING_SECRET: signingSecret,
    LUX_FORM_INTEGRATION_TARGET: target
  }
});

if (!skipDeploy) {
  await run("firebase", [
    "deploy",
    "--only",
    functionTarget,
    "--project",
    project,
    "--non-interactive",
    "--force"
  ]);
} else {
  console.log(`Skipped function deploy for ${functionTarget}.`);
}

await run(process.execPath, ["tools/qa-provider-readiness.mjs"], {
  env: { LUX_FIREBASE_PROJECT: project }
});

console.log(`Private integration activation complete for profile ${target}. Use /portal/reporting.html to replay pending handoffs.`);
