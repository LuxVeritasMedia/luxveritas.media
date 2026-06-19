import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const issues = [];

function issue(message) {
  issues.push(message);
}

function secretShape(value) {
  return /re_[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|LUX_REPORT_TOKEN=.*[A-Za-z0-9_-]{12,}|REPORT_OPERATOR_TOKEN=.*[A-Za-z0-9_-]{12,}|FORM_INTEGRATION_URL=https:\/\/\S+/i.test(value);
}

const [markdownResult, jsonResult, profilesRaw] = await Promise.all([
  execFileAsync(process.execPath, ["tools/export-private-integration-request.mjs"], {
    timeout: 30000,
    maxBuffer: 1024 * 1024 * 4
  }),
  execFileAsync(process.execPath, ["tools/export-private-integration-request.mjs"], {
    env: { ...process.env, LUX_PRIVATE_INTEGRATION_PACKET_FORMAT: "json" },
    timeout: 30000,
    maxBuffer: 1024 * 1024 * 4
  }),
  readFile("docs/private-integration-profiles.json", "utf8")
]);

const markdown = markdownResult.stdout;
const jsonRaw = jsonResult.stdout;
const registry = JSON.parse(profilesRaw);
const profiles = Array.isArray(registry.profiles) ? registry.profiles : [];

if (secretShape(markdown) || secretShape(jsonRaw)) {
  issue("private integration request appears to contain secret-shaped data");
}

for (const marker of [
  "# Lux Veritas Private Integration Activation Request",
  "No-secret private handoff activation request",
  "Current Handoff Gate",
  "Required Firebase Secrets",
  "Active Or Ready Profiles",
  "Future Profiles",
  "Activation Commands",
  "LUX_PRIVATE_INTEGRATION_ACTIVATION_DRY_RUN=1",
  "LUX_PRIVATE_INTEGRATION_ALLOW_FUTURE=1",
  "node tools/activate-private-integration.mjs",
  "node tools/qa-provider-readiness.mjs",
  "node tools/qa-integrations.mjs",
  "node tools/qa-integration-contract.mjs",
  "node tools/qa-release-readiness.mjs"
]) {
  if (!markdown.includes(marker)) issue(`markdown request missing marker: ${marker}`);
}

let packet = null;
try {
  packet = JSON.parse(jsonRaw);
} catch (error) {
  issue(`private integration request JSON is invalid: ${error?.message || String(error)}`);
}

if (packet) {
  if (packet.schemaVersion !== "luxveritas.private_integration_request.v1") {
    issue("private integration request schemaVersion mismatch");
  }
  if (packet.project !== "LuxVeritas.media") issue("private integration request project mismatch");
  if (packet.liveUrl !== "https://luxveritas.media") issue("private integration request liveUrl mismatch");
  if (!packet.assetVersion) issue("private integration request assetVersion missing");
  if (packet.registry?.schemaVersion !== registry.schemaVersion) issue("profile registry schema mismatch");
  if (packet.contract?.schemaVersion !== "luxveritas.form_submission.v1") issue("contract schema mismatch");
  if (packet.contract?.eventType !== "form.submission.received") issue("contract event mismatch");
  for (const header of ["X-Lux-Event", "X-Lux-Idempotency-Key", "X-Lux-Target", "X-Lux-Signature"]) {
    if (!packet.contract?.headers?.includes(header)) issue(`contract missing header ${header}`);
  }
  for (const secret of ["FORM_INTEGRATION_URL", "FORM_INTEGRATION_SIGNING_SECRET", "FORM_INTEGRATION_TARGET"]) {
    if (!packet.requiredSecrets?.includes(secret)) issue(`private integration request missing secret ${secret}`);
  }
  for (const profile of profiles) {
    const bucket = profile.status === "future" ? packet.futureProfiles : packet.approvedProfiles;
    const requestProfile = bucket?.find((item) => item.id === profile.id);
    if (!requestProfile) {
      issue(`private integration request missing profile ${profile.id}`);
      continue;
    }
    if (requestProfile.targetSecretValue !== profile.targetSecretValue) {
      issue(`${profile.id}: targetSecretValue mismatch`);
    }
  }
  for (const id of ["ghl_crm", "google_workspace", "codex_ops"]) {
    const futureProfile = packet.futureProfiles?.find((profile) => profile.id === id);
    if (!futureProfile?.approvalRequired?.includes("LUX_PRIVATE_INTEGRATION_ALLOW_FUTURE=1")) {
      issue(`future profile ${id} missing approval guard`);
    }
  }
  for (const command of [
    "node tools/activate-private-integration.mjs",
    "node tools/qa-provider-readiness.mjs",
    "node tools/qa-release-readiness.mjs"
  ]) {
    if (!packet.activationCommands?.some((item) => item.includes(command))) {
      issue(`private integration request missing activation command ${command}`);
    }
  }
}

if (/hooks\.|webhookUrl|bearer|password|api[_ -]?key/i.test(`${markdown}\n${jsonRaw}`.replace(/No-secret/g, ""))) {
  issue("private integration request appears to contain provider credential language");
}

if (issues.length) {
  console.error(`Private integration request QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log("Private integration request QA passed.");
