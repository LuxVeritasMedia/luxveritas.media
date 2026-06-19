import { readFile } from "node:fs/promises";

const issues = [];
const fieldMapRaw = await readFile("docs/private-integration-field-map.json", "utf8");
const profilesRaw = await readFile("docs/private-integration-profiles.json", "utf8");
const contractJs = await readFile("functions/integration-contract.js", "utf8");
const fieldMap = JSON.parse(fieldMapRaw);
const registry = JSON.parse(profilesRaw);
const mapProfiles = Array.isArray(fieldMap.profiles) ? fieldMap.profiles : [];
const registryProfiles = Array.isArray(registry.profiles) ? registry.profiles : [];
const registryIds = new Set(registryProfiles.map((profile) => profile.id));
const requiredIds = [
  "firebase_handoff",
  "private_workflow",
  "ghl_crm",
  "google_workspace",
  "codex_ops"
];
const requiredPaths = [
  "schemaVersion",
  "eventType",
  "idempotencyKey",
  "integrationTarget",
  "submissionId",
  "receiptId",
  "receivedAt",
  "sourcePage",
  "inquiryKey",
  "accessPath",
  "portalRoleTarget",
  "routing.queue",
  "routing.priority",
  "contact.email",
  "consent.email",
  "legal.publicTermsVersion",
  "legal.privacyVersion",
  "legal.termsVersion",
  "legal.submissionTermsVersion",
  "message"
];
const allowedFieldKeys = new Set([
  "identityFields",
  "routingFields",
  "auditFields",
  "tagFields",
  "archiveFields",
  "packetFields"
]);

function issue(message) {
  issues.push(message);
}

if (fieldMap.schemaVersion !== "luxveritas.private_integration_field_map.v1") {
  issue("field map schemaVersion mismatch");
}
if (fieldMap.contract !== "luxveritas.form_submission.v1") {
  issue("field map contract mismatch");
}
if (fieldMap.eventType !== "form.submission.received") {
  issue("field map eventType mismatch");
}
if (!fieldMap.purpose || !/must not contain provider URLs/i.test(fieldMap.purpose)) {
  issue("field map purpose must state the no-URL/no-secret rule");
}
if (!contractJs.includes("luxveritas.form_submission.v1") || !contractJs.includes("form.submission.received")) {
  issue("integration contract source does not expose expected schema/event markers");
}

const requiredPayloadPaths = Array.isArray(fieldMap.requiredPayloadPaths) ? fieldMap.requiredPayloadPaths : [];
for (const path of requiredPaths) {
  if (!requiredPayloadPaths.includes(path)) issue(`field map missing required payload path ${path}`);
}

const ids = new Set(mapProfiles.map((profile) => profile.id));
for (const id of requiredIds) {
  if (!ids.has(id)) issue(`field map missing profile ${id}`);
  if (!registryIds.has(id)) issue(`profile registry missing field-map id ${id}`);
}
for (const profile of mapProfiles) {
  if (!registryIds.has(profile.id)) issue(`${profile.id || "unknown"}: field-map profile not in profile registry`);
  if (!profile.destinationType || !/^[a-z0-9_]+$/.test(profile.destinationType)) {
    issue(`${profile.id}: invalid destinationType`);
  }
  if (!profile.primaryRecord || !/^[a-z0-9_]+$/.test(profile.primaryRecord)) {
    issue(`${profile.id}: invalid primaryRecord`);
  }
  if (!Array.isArray(profile.actions) || !profile.actions.includes("support_replay")) {
    issue(`${profile.id}: actions must include support_replay`);
  }
  if (!profile.notes) issue(`${profile.id}: missing notes`);
  const fieldKeys = Object.keys(profile).filter((key) => key.endsWith("Fields"));
  for (const key of fieldKeys) {
    if (!allowedFieldKeys.has(key)) issue(`${profile.id}: unexpected field bucket ${key}`);
    if (!Array.isArray(profile[key]) || profile[key].length < 3) {
      issue(`${profile.id}: ${key} must include at least three payload paths`);
    }
  }
  const profileFields = fieldKeys.flatMap((key) => profile[key]);
  for (const path of ["receiptId", "contact.email", "routing.queue"]) {
    if (!profileFields.includes(path)) issue(`${profile.id}: field buckets must include ${path}`);
  }
}

if (/https?:\/\//i.test(fieldMapRaw)) {
  issue("field map must not contain URLs");
}
if (/webhook|api[_ -]?key|bearer|password|token\s*[:=]|secret\s*[:=]|account[_ -]?id|endpoint path/i.test(fieldMapRaw)) {
  issue("field map appears to contain provider credential or endpoint language");
}

if (issues.length) {
  console.error(`Private integration field-map QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`Private integration field-map QA passed for ${mapProfiles.length} profile mapping(s).`);
