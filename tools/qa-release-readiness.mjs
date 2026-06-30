import { readFile } from "node:fs/promises";
import { resolve4, resolveCname } from "node:dns/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  liveProviderDeliveryReadiness,
  providerSecretValueStatusEntries
} from "./lib/provider-readiness.mjs";
import { resolveReportOperatorToken } from "./lib/operator-token.mjs";
import { pilotEvidenceFreshness, pilotEvidenceMaxAgeHours } from "./lib/pilot-evidence-freshness.mjs";

const strict = process.env.LUX_RELEASE_STRICT === "1";
const project = process.env.LUX_FIREBASE_PROJECT || "lux-veritas-media";
const baseUrl = (process.env.LUX_LIVE_URL || "https://luxveritas.media").replace(/\/$/, "");
const { token: reportToken, source: reportTokenSource } = await resolveReportOperatorToken();
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

function hasUncheckedAny(todo, markers) {
  return todo.split("\n").some((line) => (
    line.includes("- [ ]") && markers.some((marker) => line.includes(marker))
  ));
}

function validHttps(value) {
  return typeof value === "string" && /^https:\/\//i.test(value);
}

function validPoster(value) {
  return !value || validHttps(value) || String(value).startsWith("/assets/");
}

function responseOk(status) {
  return [200, 204, 301, 302, 307, 308].includes(status);
}

async function checkHttps(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      signal: controller.signal
    });

    return {
      ok: response.ok || responseOk(response.status),
      status: response.status,
      location: response.headers.get("location") || ""
    };
  } catch {
    try {
      const { stdout } = await execFileAsync("curl", ["-sS", "-I", "--max-time", "12", url], { timeout: 15000 });
      const status = Number(stdout.match(/^HTTP\/\S+\s+(\d+)/im)?.[1] || 0);
      const location = stdout.match(/^location:\s*(.+)$/im)?.[1]?.trim() || "";
      return {
        ok: responseOk(status),
        status,
        location
      };
    } catch (error) {
      const message = String(error?.stderr || error?.message || error).split("\n")[0];
      return {
        ok: false,
        status: 0,
        error: message
      };
    }
  } finally {
    clearTimeout(timeout);
  }
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
    // Fall through to curl/dig for local runs where Node DNS/fetch is restricted.
  }
  try {
    const { stdout } = await execFileAsync("curl", [
      "-fsS",
      "-H",
      "Accept: application/dns-json",
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`
    ], { timeout: 10000 });
    const body = JSON.parse(stdout);
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

async function resolveCnameHost(hostname) {
  try {
    const records = await resolveCname(hostname);
    if (records.length) return { records, verified: true };
  } catch {
    // Fall through to DNS-over-HTTPS. Some local Node resolver paths can be flaky.
  }
  try {
    const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=CNAME`, {
      headers: { Accept: "application/dns-json" }
    });
    const body = await response.json();
    const records = Array.isArray(body.Answer)
      ? body.Answer.map((answer) => String(answer.data || "").replace(/\.$/, "")).filter(Boolean)
      : [];
    return { records, verified: true };
  } catch {
    // Fall through to curl/dig for local runs where Node DNS/fetch is restricted.
  }
  try {
    const { stdout } = await execFileAsync("curl", [
      "-fsS",
      "-H",
      "Accept: application/dns-json",
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=CNAME`
    ], { timeout: 10000 });
    const body = JSON.parse(stdout);
    const records = Array.isArray(body.Answer)
      ? body.Answer.map((answer) => String(answer.data || "").replace(/\.$/, "")).filter(Boolean)
      : [];
    return { records, verified: true };
  } catch {
    // Fall through to dig for unsandboxed local runs.
  }
  try {
    const { stdout } = await execFileAsync("dig", ["+short", "CNAME", hostname], { timeout: 10000 });
    return {
      records: stdout.split(/\s+/).map((item) => item.trim().replace(/\.$/, "")).filter(Boolean),
      verified: true
    };
  } catch {
    return { records: [], verified: false };
  }
}

function legalItemApproved(legalReview, id) {
  const item = Array.isArray(legalReview.items)
    ? legalReview.items.find((entry) => entry.id === id)
    : null;
  return Boolean(item?.status === "approved" && item.reviewedAt && item.reviewedBy);
}

const [todo, manifestRaw, buildManifestRaw, portalRoomsRaw, phaseStatusRaw, checklistRaw, legalReviewRaw, publicTermsRaw, pilotBugRegisterRaw, buildScript, workflow] = await Promise.all([
  readFile("TODO.md", "utf8"),
  readFile("data/lux-media-manifest.json", "utf8"),
  readFile("data/lux-build-manifest.json", "utf8"),
  readFile("data/lux-portal-rooms.json", "utf8"),
  readFile("data/lux-phase-status.json", "utf8"),
  readFile("data/lux-launch-readiness.json", "utf8"),
  readFile("data/lux-legal-review.json", "utf8"),
  readFile("data/lux-public-terms.json", "utf8"),
  readFile("data/lux-pilot-bug-register.json", "utf8"),
  readFile("tools/build-static.mjs", "utf8"),
  readFile(".github/workflows/firebase-hosting-live.yml", "utf8")
]);
const pilotWriteEvidenceRaw = await readFile("data/lux-pilot-write-evidence.json", "utf8");

const mediaManifest = JSON.parse(manifestRaw);
const buildManifest = JSON.parse(buildManifestRaw);
const portalRooms = JSON.parse(portalRoomsRaw);
const phaseStatus = JSON.parse(phaseStatusRaw);
const launchChecklist = JSON.parse(checklistRaw);
const legalReview = JSON.parse(legalReviewRaw);
const publicTerms = JSON.parse(publicTermsRaw);
const pilotBugRegister = JSON.parse(pilotBugRegisterRaw);
const pilotWriteEvidence = JSON.parse(pilotWriteEvidenceRaw);
const expectedAssetVersion = buildScript.match(/const assetVersion = "([^"]+)"/)?.[1] || "";
const mediaItems = Array.isArray(mediaManifest.items) ? mediaManifest.items : [];
const launchGates = Array.isArray(launchChecklist.gates) ? launchChecklist.gates : [];
const launchGateIds = new Set(launchGates.map((gate) => gate.id));
const launchGateById = new Map(launchGates.map((gate) => [gate.id, gate]));
const sourceRequiredTypes = new Set(["audio", "video", "stream"]);
const missingSources = mediaItems.filter((item) => sourceRequiredTypes.has(item.sourceType) && !validHttps(item.sourceUrl));
const invalidPosters = mediaItems.filter((item) => !validPoster(item.posterUrl));
const missingMediaContract = mediaItems.filter((item) => !item.sourceStatus || !item.reportingKey || item.sourceRequired !== true);
const sourceTypes = new Set(mediaItems.map((item) => item.sourceType));
const pilotBugItems = Array.isArray(pilotBugRegister.items) ? pilotBugRegister.items : [];
const openPilotBlockingBugs = pilotBugItems.filter((item) => (
  ["blocking", "critical"].includes(item.severity || "")
  && !["fixed", "closed", "resolved"].includes(item.status || "")
));
const openPilotHighBugs = pilotBugItems.filter((item) => (
  item.severity === "high"
  && !["fixed", "closed", "resolved"].includes(item.status || "")
));
const [providerReadiness, providerSecretValueEntries] = await Promise.all([
  liveProviderDeliveryReadiness({ baseUrl, reportToken }),
  providerSecretValueStatusEntries(project)
]);
const liveDelivery = providerReadiness.delivery;
const providerSecretValueStatus = Object.fromEntries(providerSecretValueEntries);

if (providerReadiness.warning) warnings.push(providerReadiness.warning);
if (providerReadiness.error) warnings.push(providerReadiness.error);
if (reportTokenSource === "macOS Keychain") {
  warnings.push("Using macOS Keychain operator token for protected live provider readiness.");
}

add(mediaItems.length > 0, "Media manifest contains release items.");
add(mediaManifest.schemaVersion === "luxveritas.media_manifest.v1", "Media manifest schema version is current.");
add(buildManifest.schemaVersion === "luxveritas.build_manifest.v1", "Build manifest schema version is current.");
add(Boolean(expectedAssetVersion), "Build script exposes an asset version.");
add(buildManifest.assetVersion === expectedAssetVersion && buildManifest.version === expectedAssetVersion, "Build manifest asset version matches the generated app version.");
add(buildManifest.appScript === `app.js?v=${expectedAssetVersion}` && buildManifest.stylesheet === `styles.css?v=${expectedAssetVersion}`, "Build manifest lists current app and stylesheet assets.");
add(Boolean(buildManifest.mediaManifestVersion && buildManifest.releaseRoomVersion && buildManifest.radioProgrammingVersion && buildManifest.pilotBugRegisterVersion && buildManifest.actionInventoryVersion && buildManifest.brandHouseVersion && buildManifest.fanFlywheelVersion && buildManifest.dropRoomVersion && buildManifest.portalRoomsVersion && buildManifest.phaseStatusVersion && buildManifest.publicTermsVersion), "Build manifest carries media, release room, radio programming, pilot bug register, action inventory, brand house, fan flywheel, drop room, portal rooms, phase status, and public terms version pointers.");
add(portalRooms.schemaVersion === "luxveritas.portal_rooms.v1" && portalRooms.accessMode === "request_access_only", "Portal rooms manifest defines request-access-only Phase 5 shell.");
add(phaseStatus.schemaVersion === "luxveritas.phase_status.v1" && phaseStatus.currentPhase?.id === "phase-5" && phaseStatus.currentPhase?.status === "active_pilot", "Phase status manifest reports active Phase 5 pilot prep.");
const pilotFreshness = pilotEvidenceFreshness(pilotWriteEvidence.updatedAt, { maxAgeHours: pilotEvidenceMaxAgeHours() });
if (pilotFreshness.ok) {
  passed.push(`Pilot write evidence is fresh for final launch rehearsal (${pilotFreshness.message}).`);
} else {
  blockers.push(pilotFreshness.message);
}
add(publicTerms.schemaVersion === "luxveritas.public_terms.v1", "Public terms version manifest is current.");
add(Boolean(publicTerms.version && publicTerms.privacyVersion && publicTerms.termsVersion && publicTerms.submissionTermsVersion), "Public terms manifest contains active legal version IDs.");
add(pilotBugRegister.schemaVersion === "luxveritas.pilot_bug_register.v1", "Pilot bug register schema version is current.");
add(pilotBugRegister.version === buildManifest.pilotBugRegisterVersion, "Pilot bug register version matches build manifest.");
add(pilotBugRegister.evidence?.assetVersion === expectedAssetVersion, "Pilot bug register asset version matches generated build.");
add(pilotBugRegister.evidence?.pilotWriteQaRunId === pilotWriteEvidence.qaRunId, "Pilot bug register references current pilot write evidence.");
add(pilotBugRegister.status === "no_known_blocking_bugs" && pilotBugRegister.decision === "pilot_can_continue", "Pilot bug register reports no known blocking bugs.");
add((pilotBugRegister.summary?.openBlockingBugs || 0) === 0 && openPilotBlockingBugs.length === 0, `No open pilot blocking bugs. Open: ${openPilotBlockingBugs.map((item) => item.id || item.label || "unknown").join(", ") || "none"}`);
add((pilotBugRegister.summary?.openHighBugs || 0) === openPilotHighBugs.length, "Pilot bug register high-severity count matches items.", "warning");
add(launchGates.length >= 6, "Launch readiness checklist contains required launch gates.");
for (const gateId of ["media_sources", "inbox_notifications", "private_handoff", "operator_reporting", "privacy_review", "terms_review", "www_redirect"]) {
  add(launchGateIds.has(gateId), `Launch readiness checklist includes ${gateId}.`);
}
const missingGateActionFields = launchGates.filter((gate) => (
  !gate.owner
  || !gate.blockerType
  || !gate.verification
  || !gate.nextAction
));
add(
  missingGateActionFields.length === 0,
  `Launch readiness gates include operator action fields. Missing: ${missingGateActionFields.map((gate) => gate.id || gate.label || "unknown").join(", ") || "none"}`
);
add(sourceTypes.has("audio"), "Media manifest includes an audio release path.");
add(sourceTypes.has("video"), "Media manifest includes a video/visual path.");
add(sourceTypes.has("stream"), "Media manifest includes a radio/stream path.");
add(missingMediaContract.length === 0, `Media manifest includes source-status/reporting contract fields. Missing: ${missingMediaContract.map((item) => item.id).join(", ") || "none"}`);
add(missingSources.length === 0, `Approved media sources attached for all audio/video/radio items. Missing: ${missingSources.map((item) => item.id).join(", ") || "none"}`);
add(invalidPosters.length === 0, `Media poster URLs are HTTPS or local assets when present. Invalid: ${invalidPosters.map((item) => item.id).join(", ") || "none"}`);
const mediaGate = launchGateById.get("media_sources");
add(
  missingSources.length > 0 || (mediaGate?.status !== "blocked" && !/Attach approved/i.test(mediaGate?.nextAction || "")),
  "Media launch gate matches approved source readiness."
);
const inboxGate = launchGateById.get("inbox_notifications");
const privateHandoffGate = launchGateById.get("private_handoff");
const operatorReportingGate = launchGateById.get("operator_reporting");

if (liveDelivery) {
  add(liveDelivery.emailProviderConfigured === true, "Inbox notification provider configured.");
  add(liveDelivery.integrationConfigured === true && liveDelivery.integrationTargetConfigured === true, "Private integration endpoint configured.");
  add(liveDelivery.operatorTokenConfigured === true, "Operator report token configured.");
  add(
    liveDelivery.integrationConfigured !== true || privateHandoffGate?.status === "ready",
    "Private handoff launch gate matches provider readiness."
  );
  add(
    liveDelivery.operatorTokenConfigured !== true || operatorReportingGate?.status === "ready",
    "Operator reporting launch gate matches provider readiness."
  );
  add(
    liveDelivery.emailProviderConfigured === true ? inboxGate?.status === "ready" : inboxGate?.status === "blocked",
    "Inbox notification launch gate matches provider readiness."
  );
} else {
  const inboxStatus = providerSecretValueStatus.RESEND_API_KEY;
  const integrationUrlStatus = providerSecretValueStatus.FORM_INTEGRATION_URL;
  const integrationTargetStatus = providerSecretValueStatus.FORM_INTEGRATION_TARGET;
  const operatorTokenStatus = providerSecretValueStatus.REPORT_OPERATOR_TOKEN_SHA256;
  add(
    inboxStatus?.ok === true,
    `Inbox notification provider configured${inboxStatus?.detail ? ` (${inboxStatus.detail})` : ""}.`
  );
  add(
    integrationUrlStatus?.ok === true && integrationTargetStatus?.ok === true,
    `Private integration endpoint configured${integrationTargetStatus?.detail ? ` (${integrationTargetStatus.detail})` : ""}.`
  );
  add(
    operatorTokenStatus?.ok === true,
    `Operator report token configured${operatorTokenStatus?.detail ? ` (${operatorTokenStatus.detail})` : ""}.`
  );
  add(
    !(integrationUrlStatus?.ok === true && integrationTargetStatus?.ok === true) || privateHandoffGate?.status === "ready",
    "Private handoff launch gate matches provider readiness."
  );
  add(
    operatorTokenStatus?.ok !== true || operatorReportingGate?.status === "ready",
    "Operator reporting launch gate matches provider readiness."
  );
  add(
    inboxStatus?.ok === true ? inboxGate?.status === "ready" : inboxGate?.status === "blocked",
    "Inbox notification launch gate matches provider readiness."
  );
}
add(legalReview.schemaVersion === "luxveritas.legal_review.v1", "Legal review manifest schema version is current.");
if (legalItemApproved(legalReview, "privacy")) {
  passed.push("Privacy page legal review is approved.");
} else {
  blockers.push("Privacy page legal review is not approved.");
}
if (legalItemApproved(legalReview, "terms")) {
  passed.push("Terms page legal review is approved.");
} else {
  blockers.push("Terms page legal review is not approved.");
}
add(!hasUncheckedAny(todo, ["Attach approved release audio, video, and radio sources"]), "Approved release audio, video, and radio sources attached.");
add(workflow.includes("node tools/qa-browser-flows.mjs"), "Browser-flow QA is enforced before Hosting deploy.");
add(workflow.includes("node tools/qa-pilot-bug-register.mjs"), "Pilot bug register QA is enforced before Hosting deploy.");
add(workflow.includes("node tools/qa-live-site.mjs"), "Live-site QA is enforced after Hosting deploy.");
add(workflow.includes("node tools/qa-live-assets.mjs"), "Live asset QA is enforced after Hosting deploy.");
add(workflow.includes("node tools/qa-live-media-sources.mjs"), "Live media-source QA is enforced after Hosting deploy.");
add(workflow.includes("LUX_BROWSER_BASE_URL=https://luxveritas.media node tools/qa-browser-flows.mjs"), "Live browser-flow QA is enforced after Hosting deploy.");

const [rootDns, wwwDns, wwwCnameDns, rootHttps, wwwHttps] = await Promise.all([
  resolveHost("luxveritas.media"),
  resolveHost("www.luxveritas.media"),
  resolveCnameHost("www.luxveritas.media"),
  checkHttps("https://luxveritas.media"),
  checkHttps("https://www.luxveritas.media")
]);

if (rootDns.verified) {
  add(rootDns.records.includes(rootIp), `Root domain resolves to Firebase Hosting (${rootIp}). Found: ${rootDns.records.join(", ") || "none"}`);
} else {
  warnings.push("Root DNS could not be verified from this environment.");
}
add(rootHttps.ok, `https://luxveritas.media responds with HTTP ${rootHttps.status || rootHttps.error || "not ready"}.`);

if (wwwDns.verified || wwwCnameDns.verified) {
  const found = [
    wwwDns.records.length ? `A=${wwwDns.records.join(", ")}` : null,
    wwwCnameDns.records.length ? `CNAME=${wwwCnameDns.records.join(", ")}` : null
  ].filter(Boolean).join(" ");
  const wwwDnsReady = wwwDns.records.length > 0 || wwwCnameDns.records.length > 0;
  add(wwwDnsReady, `www.luxveritas.media has DNS records. Found: ${found || "none"}`);
  add(
    !wwwDnsReady || wwwHttps.ok,
    `https://www.luxveritas.media responds with HTTP ${wwwHttps.status || wwwHttps.error || "not ready"}.`
  );
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
