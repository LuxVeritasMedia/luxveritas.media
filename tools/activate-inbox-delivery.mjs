import { spawn } from "node:child_process";

const project = process.env.LUX_FIREBASE_PROJECT || "lux-veritas-media";
const apiKey = process.env.LUX_RESEND_API_KEY || "";
const dryRun = process.env.LUX_INBOX_ACTIVATION_DRY_RUN === "1";
const skipDeploy = process.env.LUX_INBOX_ACTIVATION_SKIP_DEPLOY === "1";
const skipDomainCheck = process.env.LUX_INBOX_ACTIVATION_SKIP_DOMAIN_CHECK === "1";
const writeTest = process.env.LUX_INBOX_ACTIVATION_WRITE_TEST === "1";
const functionTarget = "functions:submitForm,functions:reportActivity";

function usage(exitCode = 1) {
  console.error("Set LUX_RESEND_API_KEY to the approved Resend API key, then run:");
  console.error("  LUX_RESEND_API_KEY='re_...' node tools/activate-inbox-delivery.mjs");
  console.error("");
  console.error("Optional checks:");
  console.error("  LUX_INBOX_ACTIVATION_DRY_RUN=1 validates the activation path without writing secrets or deploying.");
  console.error("  LUX_INBOX_ACTIVATION_SKIP_DOMAIN_CHECK=1 skips the Resend sender-domain readiness check.");
  console.error("  LUX_INBOX_ACTIVATION_WRITE_TEST=1 sends a live QA form and requires inbox delivery.");
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

if (!apiKey) usage();

if (!/^re_/i.test(apiKey)) {
  console.error("LUX_RESEND_API_KEY does not look like a Resend API key. Expected it to start with re_.");
  process.exit(1);
}

if (dryRun) {
  console.log(`Dry run passed for inbox activation in project ${project}.`);
  console.log(`Would verify Resend sender-domain readiness, set RESEND_API_KEY, deploy ${functionTarget}, then run provider readiness.`);
  if (writeTest) console.log("Would also run live form write QA with inbox delivery required.");
  process.exit(0);
}

if (!skipDomainCheck) {
  await run(process.execPath, ["tools/qa-resend-domain-readiness.mjs"], {
    env: {
      LUX_RESEND_API_KEY: apiKey,
      LUX_RESEND_DOMAIN_STRICT: "1",
      LUX_RESEND_DOMAIN: process.env.LUX_RESEND_DOMAIN || "luxveritas.media",
      LUX_RESEND_FROM_EMAIL: process.env.LUX_RESEND_FROM_EMAIL || "forms@luxveritas.media"
    }
  });
} else {
  console.log("Skipped Resend sender-domain readiness check.");
}

await run(process.execPath, ["tools/setup-inbox-provider-secret.mjs"], {
  env: { LUX_RESEND_API_KEY: apiKey, LUX_FIREBASE_PROJECT: project }
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

if (writeTest) {
  await run(process.execPath, ["tools/qa-form-delivery.mjs"], {
    env: {
      LUX_FORM_WRITE: "1",
      LUX_EXPECT_EMAIL_SENT: "1",
      LUX_STRICT_LIVE_QA: "1"
    }
  });
}

console.log("Inbox delivery activation complete. Use /portal/reporting.html to replay pending inbox notifications.");
