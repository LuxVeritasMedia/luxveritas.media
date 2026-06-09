import { readFile } from "node:fs/promises";

const issues = [];
const appJs = await readFile("app.js", "utf8");
const functionJs = await readFile("functions/index.js", "utf8");
const buildScript = await readFile("tools/build-static.mjs", "utf8");
const doc = await readFile("docs/portal-access-model.md", "utf8");
const portalHtml = await readFile("portal/index.html", "utf8");

const portalRoles = ["visitor", "member", "artist", "creator", "press", "partner", "investor", "operator", "admin"];
const publicRoleLabels = ["Member", "Artist", "Creator", "Press", "Partner", "Investor", "Event guest", "General"];
const publicAccessKeys = ["member", "artist", "creator", "press", "partner", "investor", "event_guest", "general"];
const portalSurfaceKeys = ["member", "artist", "creator", "press", "partner", "investor", "operator"];
const inquiryLabels = ["Membership", "Submissions", "Events", "Press", "Partnership", "Licensing", "Investor", "Portal", "General"];
const inquiryKeys = ["membership", "submissions", "events", "press", "partnership", "licensing", "investor", "portal", "general"];
const payloadFields = [
  "client_submission_id",
  "role_path",
  "access_path",
  "portal_role_target",
  "inquiry_type",
  "inquiry_key",
  "routing_queue",
  "routing_priority",
  "routing_next_action",
  "consent_email",
  "consent_sms"
];

for (const role of portalRoles) {
  if (!doc.includes(`\`${role}\``)) issues.push(`docs/portal-access-model.md: missing portal role ${role}`);
}

for (const label of publicRoleLabels) {
  if (!buildScript.includes(`<option>${label}</option>`)) {
    issues.push(`tools/build-static.mjs: public form missing role option ${label}`);
  }
  if (!appJs.includes(`${label}:`) && !appJs.includes(`"${label}":`)) {
    issues.push(`app.js: accessPathMap missing role label ${label}`);
  }
  if (!functionJs.includes(`${label}:`) && !functionJs.includes(`"${label}":`)) {
    issues.push(`functions/index.js: accessPathMap missing role label ${label}`);
  }
}

for (const key of publicAccessKeys) {
  if (!appJs.includes(`accessPath: "${key}"`)) issues.push(`app.js: missing access path key ${key}`);
  if (!functionJs.includes(`access_path: "${key}"`)) issues.push(`functions/index.js: missing access path key ${key}`);
  if (!doc.includes(`\`${key}\``)) issues.push(`docs/portal-access-model.md: missing access path key ${key}`);
}

for (const key of portalSurfaceKeys) {
  if (!portalHtml.includes(`data-portal-role="${key}"`)) {
    issues.push(`portal/index.html: portal shell missing role card ${key}`);
  }
}

for (const marker of ["portalAccessCards", "portalIndex", "Portal Surface Model"]) {
  if (!buildScript.includes(marker) && !doc.includes(marker)) {
    issues.push(`portal access model missing marker ${marker}`);
  }
}

for (const label of inquiryLabels) {
  if (!buildScript.includes(`<option>${label}</option>`)) {
    issues.push(`tools/build-static.mjs: public form missing inquiry option ${label}`);
  }
  if (!appJs.includes(`${label}:`) && !appJs.includes(`"${label}":`)) {
    issues.push(`app.js: inquiryKeyMap missing label ${label}`);
  }
  if (!functionJs.includes(`${label}:`) && !functionJs.includes(`"${label}":`)) {
    issues.push(`functions/index.js: inquiryKeyMap missing label ${label}`);
  }
}

for (const key of inquiryKeys) {
  if (!appJs.includes(`"${key}"`)) issues.push(`app.js: missing inquiry key ${key}`);
  if (!functionJs.includes(`"${key}"`)) issues.push(`functions/index.js: missing inquiry key ${key}`);
  if (!doc.includes(`\`${key}\``)) issues.push(`docs/portal-access-model.md: missing inquiry key ${key}`);
}

for (const field of payloadFields) {
  if (!doc.includes(`\`${field}\``)) issues.push(`docs/portal-access-model.md: missing interface field ${field}`);
  if (!functionJs.includes(field)) issues.push(`functions/index.js: missing interface field ${field}`);
}

for (const forbiddenPublicRole of ["Operator", "Admin"]) {
  if (buildScript.includes(`<option>${forbiddenPublicRole}</option>`)) {
    issues.push(`tools/build-static.mjs: public form exposes ${forbiddenPublicRole}`);
  }
}

for (const marker of [
  "recognized role path is required",
  "recognized inquiry type is required",
  "byAccessPath",
  "byPortalRoleTarget",
  "deriveRouting",
  "byRoutingQueue",
  "byRoutingPriority"
]) {
  if (!functionJs.includes(marker)) issues.push(`functions/index.js: missing access-model marker ${marker}`);
}

if (issues.length) {
  console.error(`Access model QA failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log("Access model QA passed.");
