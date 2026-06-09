import { spawn } from "node:child_process";

const apiKey = process.env.LUX_RESEND_API_KEY || "";
const project = process.env.LUX_FIREBASE_PROJECT || "lux-veritas-media";
const dryRun = process.env.LUX_INBOX_SECRET_DRY_RUN === "1";

if (!apiKey) {
  console.error("Set LUX_RESEND_API_KEY to the approved Resend API key, then run:");
  console.error("  LUX_RESEND_API_KEY='re_...' node tools/setup-inbox-provider-secret.mjs");
  console.error("");
  console.error("To keep the runtime mounted but offline, set the sentinel value manually:");
  console.error("  printf '%s' 'not_configured' | firebase functions:secrets:set RESEND_API_KEY --project lux-veritas-media");
  process.exit(1);
}

if (!/^re_/i.test(apiKey)) {
  console.error("LUX_RESEND_API_KEY does not look like a Resend API key. Expected it to start with re_.");
  process.exit(1);
}

if (dryRun) {
  console.log(`Dry run passed for RESEND_API_KEY setup in project ${project}.`);
  process.exit(0);
}

const child = spawn("firebase", [
  "functions:secrets:set",
  "RESEND_API_KEY",
  "--project",
  project
], {
  stdio: ["pipe", "inherit", "inherit"]
});

child.stdin.end(apiKey);

child.on("exit", (code) => {
  if (code) process.exit(code);
  console.log("RESEND_API_KEY secret updated. Redeploy submitForm and reportActivity, then run LUX_EXPECT_EMAIL_SENT=1 QA after the sender domain is verified.");
});
