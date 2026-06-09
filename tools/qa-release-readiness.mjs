import { readFile } from "node:fs/promises";
import { resolve4 } from "node:dns/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const strict = process.env.LUX_RELEASE_STRICT === "1";
const rootIp = "199.36.158.100";
const blockers = [];
const warnings = [];
const passed = [];
const execFileAsync = promisify(execFile);

function add(condition, message, level = "blocker") {
  if (condition) {
    passed.push(message);
  } else if (level === "warning") {
    warnings.push(message);
  } else {
    blockers.push(message);
  }
}

function hasUnchecked(todo, text) {
  return todo.split("\n").some((line) => line.includes("- [ ]") && line.includes(text));
}

function hasUncheckedAny(todo, markers) {
  return todo.split("\n").some((line) => (
    line.includes("- [ ]") && markers.some((marker) => line.includes(marker))
  ));
}

function validHttps(value) {
  return typeof value === "string" && /^https:\/\//i.test(value);
}

async function resolveHost(hostname) {
  try {
    const records = await resolve4(hostname);
    if (records.length) return { records, verified: true };
  } catch {
    // Fall through to DNS-over-HTTPS. Some local Node resolver paths can be flaky.
  }
  try {
    const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`, {
      headers: { Accept: "application/dns-json" }
    });
    const body = await response.json();
    const records = Array.isArray(body.Answer)
      ? body.Answer.map((answer) => answer.data).filter((item) => /^\d+\.\d+\.\d+\.\d+$/.test(item))
      : [];
    return { records, verified: true };
  } catch {
    // Fall through to dig for unsandboxed local runs.
  }
  try {
    const { stdout } = await execFileAsync("dig", ["+short", hostname], { timeout: 10000 });
    return {
      records: stdout.split(/\s+/).map((item) => item.trim()).filter((item) => /^\d+\.\d+\.\d+\.\d+$/.test(item)),
      verified: true
    };
  } catch {
    return { records: [], verified: false };
  }
}

const [todo, manifestRaw, checklistRaw, workflow] = await Promise.all([
  readFile("TODO.md", "utf8"),
  readFile("data/lux-media-manifest.json", "utf8"),
  readFile("data/lux-launch-readiness.json", "utf8"),
  readFile(".github/workflows/firebase-hosting-live.yml", "utf8")
]);

const mediaManifest = JSON.parse(manifestRaw);
const launchChecklist = JSON.parse(checklistRaw);
const mediaItems = Array.isArray(mediaManifest.items) ? mediaManifest.items : [];
const launchGates = Array.isArray(launchChecklist.gates) ? launchChecklist.gates : [];
const launchGateIds = new Set(launchGates.map((gate) => gate.id));
const sourceRequiredTypes = new Set(["audio", "video", "stream"]);
const missingSources = mediaItems.filter((item) => sourceRequiredTypes.has(item.sourceType) && !validHttps(item.sourceUrl));
const invalidPosters = mediaItems.filter((item) => item.posterUrl && !validHttps(item.posterUrl));
const missingMediaContract = mediaItems.filter((item) => !item.sourceStatus || !item.reportingKey || item.sourceRequired !== true);
const sourceTypes = new Set(mediaItems.map((item) => item.sourceType));

add(mediaItems.length > 0, "Media manifest contains release items.");
add(mediaManifest.schemaVersion === "luxveritas.media_manifest.v1", "Media manifest schema version is current.");
add(launchGates.length >= 6, "Launch readiness checklist contains required launch gates.");
for (const gateId of ["media_sources", "inbox_notifications", "private_handoff", "privacy_review", "terms_review", "www_redirect"]) {
  add(launchGateIds.has(gateId), `Launch readiness checklist includes ${gateId}.`);
}
add(sourceTypes.has("audio"), "Media manifest includes an audio release path.");
add(sourceTypes.has("video"), "Media manifest includes a video/visual path.");
add(sourceTypes.has("stream"), "Media manifest includes a radio/stream path.");
add(missingMediaContract.length === 0, `Media manifest includes source-status/reporting contract fields. Missing: ${missingMediaContract.map((item) => item.id).join(", ") || "none"}`);
add(missingSources.length === 0, `Approved media sources attached for all audio/video/radio items. Missing: ${missingSources.map((item) => item.id).join(", ") || "none"}`);
add(invalidPosters.length === 0, `Media poster URLs are HTTPS when present. Invalid: ${invalidPosters.map((item) => item.id).join(", ") || "none"}`);

add(!hasUncheckedAny(todo, [
  "Configure email provider runtime secrets",
  "Configure and verify email provider",
  "RESEND_API_KEY",
  "inbox notification"
]), "Inbox notification provider configured.");
add(!hasUnchecked(todo, "Configure approved private integration endpoint"), "Private integration endpoint configured.");
add(!hasUnchecked(todo, "Legal review: Privacy"), "Privacy page legal review complete.");
add(!hasUnchecked(todo, "Legal review: Terms"), "Terms page legal review complete.");
add(!hasUnchecked(todo, "Attach approved release audio, video, and radio sources"), "Approved release audio, video, and radio sources attached.");
add(!hasUnchecked(todo, "Configure www.luxveritas.media DNS and Hosting redirect"), "www DNS and Hosting redirect configured.");

add(workflow.includes("node tools/qa-browser-flows.mjs"), "Browser-flow QA is enforced before Hosting deploy.");
add(workflow.includes("node tools/qa-live-site.mjs"), "Live-site QA is enforced after Hosting deploy.");

const [rootDns, wwwDns] = await Promise.all([
  resolveHost("luxveritas.media"),
  resolveHost("www.luxveritas.media")
]);

if (rootDns.verified) {
  add(rootDns.records.includes(rootIp), `Root domain resolves to Firebase Hosting (${rootIp}). Found: ${rootDns.records.join(", ") || "none"}`);
} else {
  warnings.push("Root DNS could not be verified from this environment.");
}

if (wwwDns.verified) {
  add(wwwDns.records.length > 0, `www.luxveritas.media resolves. Found: ${wwwDns.records.join(", ") || "none"}`);
} else {
  warnings.push("www DNS could not be verified from this environment.");
}

if (warnings.length) {
  console.warn("Release readiness warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (blockers.length) {
  const prefix = strict ? "Release readiness failed" : "Release readiness blockers";
  console.warn(`${prefix} with ${blockers.length} item(s):`);
  for (const blocker of blockers) console.warn(`- ${blocker}`);
  if (strict) process.exit(1);
}

console.log(`Release readiness checked: ${passed.length} passed, ${warnings.length} warning(s), ${blockers.length} blocker(s).`);
if (!strict && blockers.length) {
  console.log("Run with LUX_RELEASE_STRICT=1 when launch blockers must fail the command.");
}
