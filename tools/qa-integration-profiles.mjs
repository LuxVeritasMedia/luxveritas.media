import { readFile } from "node:fs/promises";

const issues = [];
const raw = await readFile("docs/private-integration-profiles.json", "utf8");
const registry = JSON.parse(raw);
const profiles = Array.isArray(registry.profiles) ? registry.profiles : [];
const requiredIds = [
  "firebase_handoff",
  "private_workflow",
  "ghl_crm",
  "google_workspace",
  "codex_ops"
];
const requiredSecrets = [
  "FORM_INTEGRATION_URL",
  "FORM_INTEGRATION_SIGNING_SECRET",
  "FORM_INTEGRATION_TARGET"
];
const allowedStatuses = new Set(["pilot_active", "ready_label", "future"]);
const allowedExposure = new Set(["none"]);
const idPattern = /^[a-z0-9_-]+$/;

function issue(message) {
  issues.push(message);
}

if (registry.schemaVersion !== "luxveritas.private_integration_profiles.v1") {
  issue("profile registry schemaVersion mismatch");
}
if (!registry.purpose || !/must not contain provider URLs/i.test(registry.purpose)) {
  issue("profile registry purpose must state the no-URL/no-secret rule");
}
if (!profiles.length) {
  issue("profile registry has no profiles");
}

const ids = new Set(profiles.map((profile) => profile.id));
for (const id of requiredIds) {
  if (!ids.has(id)) issue(`missing required profile ${id}`);
}

for (const profile of profiles) {
  if (!idPattern.test(profile.id || "")) issue(`${profile.id || "unknown"}: invalid id`);
  if (!idPattern.test(profile.targetSecretValue || "")) issue(`${profile.id}: invalid targetSecretValue`);
  if (profile.id !== profile.targetSecretValue) {
    issue(`${profile.id}: targetSecretValue must match id so FORM_INTEGRATION_TARGET stays predictable`);
  }
  if (!profile.label) issue(`${profile.id}: missing label`);
  if (!allowedStatuses.has(profile.status)) issue(`${profile.id}: invalid status ${profile.status || "missing"}`);
  if (!profile.providerClass || !idPattern.test(profile.providerClass)) issue(`${profile.id}: invalid providerClass`);
  if (!allowedExposure.has(profile.publicExposure)) issue(`${profile.id}: publicExposure must be none`);
  if (profile.handoffContract !== "luxveritas.form_submission.v1") {
    issue(`${profile.id}: handoffContract mismatch`);
  }
  if (!Array.isArray(profile.requiredSecrets)) {
    issue(`${profile.id}: requiredSecrets must be an array`);
  } else {
    for (const secret of requiredSecrets) {
      if (!profile.requiredSecrets.includes(secret)) issue(`${profile.id}: missing required secret ${secret}`);
    }
  }
  if (!Array.isArray(profile.allowedActions) || !profile.allowedActions.includes("replay")) {
    issue(`${profile.id}: allowedActions must include replay`);
  }
  if (!profile.notes) issue(`${profile.id}: missing notes`);
}

if (/https?:\/\//i.test(raw)) {
  issue("profile registry must not contain URLs");
}
if (/webhook|api[_ -]?key|secret value|bearer|password/i.test(raw.replace(/FORM_INTEGRATION_SIGNING_SECRET/g, ""))) {
  issue("profile registry appears to contain provider credential language");
}

if (issues.length) {
  console.error(`Integration profile QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`Integration profile QA passed for ${profiles.length} profile(s).`);
