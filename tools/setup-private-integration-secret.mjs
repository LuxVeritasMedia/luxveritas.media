import { spawn } from "node:child_process";

const project = process.env.LUX_FIREBASE_PROJECT || "lux-veritas-media";
const url = process.env.LUX_FORM_INTEGRATION_URL || "";
const signingSecret = process.env.LUX_FORM_INTEGRATION_SIGNING_SECRET || "not_configured";
const target = process.env.LUX_FORM_INTEGRATION_TARGET || "private_workflow";
const dryRun = process.env.LUX_PRIVATE_INTEGRATION_DRY_RUN === "1";

if (!url) {
  console.error("Set LUX_FORM_INTEGRATION_URL to the approved HTTPS private workflow endpoint, then run:");
  console.error("  LUX_FORM_INTEGRATION_URL='https://...' LUX_FORM_INTEGRATION_TARGET='private_workflow' node tools/setup-private-integration-secret.mjs");
  console.error("");
  console.error("To keep the runtime mounted but offline, set sentinel values manually:");
  console.error("  printf '%s' 'not_configured' | firebase functions:secrets:set FORM_INTEGRATION_URL --project lux-veritas-media");
  console.error("  printf '%s' 'not_configured' | firebase functions:secrets:set FORM_INTEGRATION_SIGNING_SECRET --project lux-veritas-media");
  console.error("  printf '%s' 'unconfigured' | firebase functions:secrets:set FORM_INTEGRATION_TARGET --project lux-veritas-media");
  process.exit(1);
}

if (!/^https:\/\//i.test(url)) {
  console.error("LUX_FORM_INTEGRATION_URL must be HTTPS.");
  process.exit(1);
}

if (!/^[a-z0-9_-]{3,80}$/i.test(target)) {
  console.error("LUX_FORM_INTEGRATION_TARGET must be a short profile label using letters, numbers, underscores, or hyphens.");
  process.exit(1);
}

const secrets = [
  ["FORM_INTEGRATION_URL", url],
  ["FORM_INTEGRATION_SIGNING_SECRET", signingSecret],
  ["FORM_INTEGRATION_TARGET", target]
];

if (dryRun) {
  console.log(`Dry run passed for private integration secrets in project ${project}.`);
  console.log(`Target profile: ${target}`);
  process.exit(0);
}

async function setSecret(name, value) {
  await new Promise((resolve, reject) => {
    const child = spawn("firebase", [
      "functions:secrets:set",
      name,
      "--project",
      project
    ], {
      stdio: ["pipe", "inherit", "inherit"]
    });
    child.stdin.end(value);
    child.on("exit", (code) => {
      if (code) reject(new Error(`${name} secret update failed with exit code ${code}`));
      else resolve();
    });
  });
}

for (const [name, value] of secrets) {
  await setSecret(name, value);
}

console.log("Private integration secrets updated. Redeploy submitForm and reportActivity, then use Replay Pending Handoff in /portal/reporting.html.");
