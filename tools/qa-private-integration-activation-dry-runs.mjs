import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";

const execFileAsync = promisify(execFile);
const node = process.execPath;
const issues = [];
const registry = JSON.parse(await readFile("docs/private-integration-profiles.json", "utf8"));
const profiles = Array.isArray(registry.profiles) ? registry.profiles : [];
const requiredFutureTargets = ["ghl_crm", "google_workspace", "codex_ops"];
const placeholderUrl = "https://approved-private-receiver.example/intake";
const placeholderSecret = "approved-shared-secret-for-dry-run-only";

function issue(message) {
  issues.push(message);
}

function outputText(result) {
  return `${result.stdout || ""}${result.stderr || ""}`;
}

async function runActivation(profile, extraEnv = {}) {
  try {
    const result = await execFileAsync(node, ["tools/activate-private-integration.mjs"], {
      env: {
        ...process.env,
        LUX_PRIVATE_INTEGRATION_ACTIVATION_DRY_RUN: "1",
        LUX_FORM_INTEGRATION_URL: placeholderUrl,
        LUX_FORM_INTEGRATION_SIGNING_SECRET: placeholderSecret,
        LUX_FORM_INTEGRATION_TARGET: profile.targetSecretValue,
        ...extraEnv
      },
      timeout: 30000,
      maxBuffer: 1024 * 1024
    });
    return { ok: true, code: 0, ...result };
  } catch (error) {
    return {
      ok: false,
      code: error.code,
      stdout: String(error.stdout || ""),
      stderr: String(error.stderr || ""),
      message: error.message
    };
  }
}

if (!profiles.length) issue("private integration profile registry has no profiles");

for (const id of requiredFutureTargets) {
  const profile = profiles.find((item) => item.id === id);
  if (!profile) {
    issue(`missing required future activation target ${id}`);
  } else if (profile.status !== "future") {
    issue(`${id}: expected status future before real provider approval`);
  }
}

for (const profile of profiles) {
  if (!profile?.targetSecretValue) {
    issue(`${profile?.id || "unknown"}: missing targetSecretValue`);
    continue;
  }

  const normal = await runActivation(profile);
  const text = outputText(normal);
  if (profile.status === "future") {
    if (normal.ok) {
      issue(`${profile.id}: future profile dry run passed without LUX_PRIVATE_INTEGRATION_ALLOW_FUTURE=1`);
    }
    if (!/marked future/i.test(text) || !/LUX_PRIVATE_INTEGRATION_ALLOW_FUTURE=1/i.test(text)) {
      issue(`${profile.id}: future profile rejection did not explain the approval flag`);
    }

    const approved = await runActivation(profile, { LUX_PRIVATE_INTEGRATION_ALLOW_FUTURE: "1" });
    const approvedText = outputText(approved);
    if (!approved.ok) {
      issue(`${profile.id}: future profile dry run failed even with approval flag (${approvedText || approved.message})`);
    }
    if (!/Dry run passed/i.test(approvedText) || !approvedText.includes(profile.targetSecretValue)) {
      issue(`${profile.id}: approved dry run did not confirm profile target`);
    }
  } else {
    if (!normal.ok) {
      issue(`${profile.id}: active/ready profile dry run failed (${text || normal.message})`);
    }
    if (!/Dry run passed/i.test(text) || !text.includes(profile.targetSecretValue)) {
      issue(`${profile.id}: dry run did not confirm profile target`);
    }
  }
}

if (issues.length) {
  console.error(`Private integration activation dry-run QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`Private integration activation dry-run QA passed for ${profiles.length} profile(s).`);
