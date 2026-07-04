import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const args = new Set(process.argv.slice(2));
const logPath = process.env.LUX_INBOX_ACTIVATION_LOG || "/tmp/lux-resend-activation.log";
const writeTest = args.has("--write-test");
const skipDeploy = args.has("--skip-deploy");
const dryRun = args.has("--dry-run");
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

process.chdir(repoRoot);

function stripControls(text) {
  return String(text).replace(/\u001b\[[0-9;]*m/g, "");
}

function log(message = "") {
  console.log(message);
  appendFileSync(logPath, `${stripControls(message)}\n`);
}

function writeChunk(chunk, stream) {
  const text = chunk.toString();
  stream.write(text);
  appendFileSync(logPath, stripControls(text));
}

function setEcho(enabled) {
  if (!process.stdin.isTTY) return;
  spawnSync("stty", [enabled ? "echo" : "-echo"], {
    stdio: ["inherit", "ignore", "ignore"]
  });
}

function readHidden(prompt) {
  if (!process.stdin.isTTY) {
    throw new Error("A TTY is required so the Resend API key can be entered without echoing.");
  }

  return new Promise((resolve, reject) => {
    let value = "";

    function cleanup() {
      setEcho(true);
      process.stdin.off("data", onData);
      process.stdin.off("error", onError);
      process.stdin.pause();
    }

    function onError(error) {
      cleanup();
      reject(error);
    }

    function onData(chunk) {
      value += chunk.toString("utf8");
      if (value.includes("\n") || value.includes("\r")) {
        cleanup();
        process.stdout.write("\n");
        resolve(value.replace(/[\r\n]+$/, ""));
      }
    }

    process.stdout.write(prompt);
    setEcho(false);
    process.stdin.resume();
    process.stdin.on("data", onData);
    process.stdin.on("error", onError);
  });
}

function runNode(label, script, env = {}) {
  return new Promise((resolve, reject) => {
    log("");
    log(`== ${label} ==`);
    const child = spawn(process.execPath, [script], {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"]
    });

    child.stdout.on("data", (chunk) => writeChunk(chunk, process.stdout));
    child.stderr.on("data", (chunk) => writeChunk(chunk, process.stderr));
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} failed with exit code ${code}`));
    });
  });
}

process.on("SIGINT", () => {
  setEcho(true);
  log("");
  log("Interrupted. No key was written by this runner.");
  process.exit(130);
});

writeFileSync(logPath, `Lux Veritas Resend inbox activation transcript\nStarted ${new Date().toISOString()}\n`);
log("Lux Veritas Resend inbox activation");
log("Target sender: forms@luxveritas.media");
log("Target Firebase project: lux-veritas-media");
log(`Transcript: ${logPath}`);
if (skipDeploy) log("Mode: skip deploy");
if (writeTest) log("Mode: live write test enabled");

if (dryRun) {
  log("");
  log("Dry run passed. Live mode will prompt for the Resend key without echoing it, then run:");
  log("- node tools/qa-resend-domain-readiness.mjs");
  log("- node tools/activate-inbox-delivery.mjs");
  log("- node tools/qa-provider-readiness.mjs");
  log("- node tools/qa-release-readiness.mjs");
  if (writeTest) log("- Live inbox write QA is enabled for this planned run.");
  process.exit(0);
}

let apiKey;
try {
  apiKey = await readHidden("Paste approved Resend API key (input hidden): ");
} finally {
  setEcho(true);
}

if (!apiKey) {
  log("No key entered; aborting.");
  process.exit(1);
}

if (!/^re_/i.test(apiKey)) {
  log("Entered value does not look like a Resend API key. Expected it to start with re_.");
  process.exit(1);
}

const baseEnv = {
  LUX_RESEND_API_KEY: apiKey,
  LUX_RESEND_DOMAIN: process.env.LUX_RESEND_DOMAIN || "luxveritas.media",
  LUX_RESEND_FROM_EMAIL: process.env.LUX_RESEND_FROM_EMAIL || "forms@luxveritas.media",
  LUX_FIREBASE_PROJECT: process.env.LUX_FIREBASE_PROJECT || "lux-veritas-media"
};

try {
  await runNode("Resend sender-domain readiness", "tools/qa-resend-domain-readiness.mjs", {
    ...baseEnv,
    LUX_RESEND_DOMAIN_STRICT: "1"
  });
  await runNode("Inbox delivery activation", "tools/activate-inbox-delivery.mjs", {
    ...baseEnv,
    LUX_INBOX_ACTIVATION_SKIP_DEPLOY: skipDeploy ? "1" : "0",
    LUX_INBOX_ACTIVATION_WRITE_TEST: writeTest ? "1" : "0"
  });
  await runNode("Provider readiness", "tools/qa-provider-readiness.mjs", {
    LUX_FIREBASE_PROJECT: baseEnv.LUX_FIREBASE_PROJECT
  });
  await runNode("Release readiness", "tools/qa-release-readiness.mjs");
  log("");
  log("Resend inbox activation checks complete.");
} catch (error) {
  log("");
  log(`BLOCK ${error.message}`);
  log("Review the non-secret transcript above, then rerun after the provider/account issue is corrected.");
  process.exit(1);
}
