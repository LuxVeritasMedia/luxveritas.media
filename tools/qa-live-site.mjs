import { readFile } from "node:fs/promises";
import { pilotEvidenceFreshness, pilotEvidenceMaxAgeHours } from "./lib/pilot-evidence-freshness.mjs";

const baseUrl = (process.env.LUX_LIVE_URL || "https://luxveritas.media").replace(/\/$/, "");
const issues = [];
const warnings = [];
const requireCurrentPilotEvidence = process.env.LUX_LIVE_SITE_REQUIRE_CURRENT_PILOT === "1";
const maxPilotAgeHours = pilotEvidenceMaxAgeHours();
let liveBuildManifest = null;
const requiredRoutes = [
  "/",
  "/music.html",
  "/spmvp.html",
  "/membership.html",
  "/submissions.html",
  "/offline.html",
  "/portal/reporting.html"
];
const buildScript = await readFile("tools/build-static.mjs", "utf8");
const actionInventoryLib = await readFile("tools/lib/action-inventory.mjs", "utf8");
const expectedAssetVersion = buildScript.match(/const assetVersion = "([^"]+)"/)?.[1];
const expectedActionInventoryVersion = actionInventoryLib.match(/actionInventoryVersion = "([^"]+)"/)?.[1];

if (!expectedAssetVersion) {
  issues.push("tools/build-static.mjs: missing assetVersion");
}

async function fetchWithTimeout(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 12000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method || "GET",
      headers: options.headers,
      body: options.body,
      signal: controller.signal
    });
    const text = options.readBody === false ? "" : await response.text();
    return { response, text };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkRoute(path) {
  try {
    const { response, text } = await fetchWithTimeout(path);
    if (!response.ok) {
      issues.push(`${path}: expected HTTP 200, received ${response.status}`);
      return "";
    }
    return text;
  } catch (error) {
    issues.push(`${path}: request failed (${error.message})`);
    return "";
  }
}

for (const route of requiredRoutes) {
  await checkRoute(route);
}

try {
  const { response } = await fetchWithTimeout("/", { method: "GET", readBody: false });
  const expectedHeaders = new Map([
    ["x-content-type-options", "nosniff"],
    ["referrer-policy", "strict-origin-when-cross-origin"],
    ["permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()"],
    ["x-frame-options", "SAMEORIGIN"],
    ["strict-transport-security", "max-age=31536000"]
  ]);
  for (const [key, value] of expectedHeaders) {
    const actual = response.headers.get(key);
    if (actual !== value) issues.push(`/: header ${key} expected ${value}, received ${actual || "missing"}`);
  }
} catch (error) {
  issues.push(`/: header check failed (${error.message})`);
}

const musicHtml = await checkRoute("/music.html");
if (musicHtml) {
  for (const required of [
    `app.js?v=${expectedAssetVersion}`,
    `styles.css?v=${expectedAssetVersion}`,
    "data-media-player",
    "data-media-source-shell",
    "data-media-action=\"play\"",
    "data-media-action=\"watch\"",
    "data-media-action=\"radio\"",
    "data-radio-readiness",
    "data-radio-on-air",
    "data-radio-listener-path",
    "data-source-type=\"audio\"",
    "data-source-type=\"video\"",
    "data-source-type=\"stream\""
  ]) {
    if (!musicHtml.includes(required)) issues.push(`/music.html: missing ${required}`);
  }
}

if (expectedAssetVersion) {
  const appJs = await checkRoute(`/app.js?v=${expectedAssetVersion}`);
  if (appJs) {
    for (const marker of ["testInboxDelivery", "lastDownloadName", "type: \"handoff\"", "function handleMediaAction", 'navigator.serviceWorker.register("/service-worker.js")']) {
      if (!appJs.includes(marker)) issues.push(`/app.js?v=${expectedAssetVersion}: missing ${marker}`);
    }
  }
}

const offlineHtml = await checkRoute("/offline.html");
if (offlineHtml) {
  for (const marker of ["Signal Paused.", "name=\"robots\" content=\"noindex, nofollow\"", "Return Home"]) {
    if (!offlineHtml.includes(marker)) issues.push(`/offline.html: missing ${marker}`);
  }
}

try {
  const { response, text } = await fetchWithTimeout("/service-worker.js");
  if (!response.ok) {
    issues.push(`/service-worker.js: expected HTTP 200, received ${response.status}`);
  } else {
    for (const marker of ["luxveritas-static-", "/offline.html", "request.mode === \"navigate\"", "/api/"]) {
      if (!text.includes(marker)) issues.push(`/service-worker.js: missing ${marker}`);
    }
    const cacheControl = response.headers.get("cache-control");
    if (cacheControl !== "no-cache") {
      issues.push(`/service-worker.js: expected Cache-Control no-cache, received ${cacheControl || "missing"}`);
    }
  }
} catch (error) {
  issues.push(`/service-worker.js: request failed (${error.message})`);
}

const reportHtml = await checkRoute("/portal/reporting.html");
if (reportHtml) {
  if (!reportHtml.includes('name="robots" content="noindex, nofollow"')) {
    issues.push("/portal/reporting.html: missing noindex metadata");
  }
  for (const marker of ["data-media-readiness-summary", "data-media-readiness-list", "data-launch-closeout-summary", "data-launch-closeout-list"]) {
    if (!reportHtml.includes(marker)) issues.push(`/portal/reporting.html: missing ${marker}`);
  }
}

try {
  const { response, text } = await fetchWithTimeout("/data/lux-build-manifest.json");
  if (!response.ok) {
    issues.push(`/data/lux-build-manifest.json: expected HTTP 200, received ${response.status}`);
  } else {
    const buildManifest = JSON.parse(text);
    liveBuildManifest = buildManifest;
    if (buildManifest.schemaVersion !== "luxveritas.build_manifest.v1") {
      issues.push("/data/lux-build-manifest.json: schemaVersion mismatch");
    }
    if (buildManifest.version !== expectedAssetVersion || buildManifest.assetVersion !== expectedAssetVersion) {
      issues.push(`/data/lux-build-manifest.json: stale asset version ${buildManifest.assetVersion || buildManifest.version || "missing"}`);
    }
    if (buildManifest.appScript !== `app.js?v=${expectedAssetVersion}`) {
      issues.push("/data/lux-build-manifest.json: appScript does not match current asset version");
    }
    if (buildManifest.stylesheet !== `styles.css?v=${expectedAssetVersion}`) {
      issues.push("/data/lux-build-manifest.json: stylesheet does not match current asset version");
    }
    if (!buildManifest.mediaManifestVersion || !buildManifest.radioProgrammingVersion || !buildManifest.pilotBugRegisterVersion || !buildManifest.actionInventoryVersion || !buildManifest.brandHouseVersion || !buildManifest.fanFlywheelVersion || !buildManifest.dropRoomVersion || !buildManifest.portalRoomsVersion || !buildManifest.phaseStatusVersion || !buildManifest.publicTermsVersion) {
      issues.push("/data/lux-build-manifest.json: missing mediaManifestVersion, radioProgrammingVersion, pilotBugRegisterVersion, actionInventoryVersion, brandHouseVersion, fanFlywheelVersion, dropRoomVersion, portalRoomsVersion, phaseStatusVersion, or publicTermsVersion");
    }
  }
} catch (error) {
  issues.push(`/data/lux-build-manifest.json: invalid response (${error.message})`);
}

try {
  const { response, text } = await fetchWithTimeout("/data/lux-action-inventory.json");
  if (!response.ok) {
    issues.push(`/data/lux-action-inventory.json: expected HTTP 200, received ${response.status}`);
  } else {
    const inventory = JSON.parse(text);
    if (inventory.schemaVersion !== "luxveritas.action_inventory.v1") {
      issues.push("/data/lux-action-inventory.json: schemaVersion mismatch");
    }
    if (expectedActionInventoryVersion && inventory.version !== expectedActionInventoryVersion) {
      issues.push("/data/lux-action-inventory.json: version does not match expected action inventory version");
    }
    if (liveBuildManifest?.actionInventoryVersion && liveBuildManifest.actionInventoryVersion !== inventory.version) {
      issues.push("/data/lux-action-inventory.json: version does not match build manifest actionInventoryVersion");
    }
    if (liveBuildManifest?.assetVersion && inventory.buildAssetVersion !== liveBuildManifest.assetVersion) {
      issues.push("/data/lux-action-inventory.json: buildAssetVersion does not match live build manifest");
    }
    if (!inventory.actionCount || !inventory.summary?.byType?.media_action || !inventory.summary?.byType?.form_open || !inventory.summary?.byType?.link_click) {
      issues.push("/data/lux-action-inventory.json: missing action summary coverage");
    }
  }
} catch (error) {
  issues.push(`/data/lux-action-inventory.json: invalid response (${error.message})`);
}

try {
  const { response, text } = await fetchWithTimeout("/data/lux-brand-house.json");
  if (!response.ok) {
    issues.push(`/data/lux-brand-house.json: expected HTTP 200, received ${response.status}`);
  } else {
    const brandHouse = JSON.parse(text);
    const marks = Array.isArray(brandHouse.houseMarks) ? brandHouse.houseMarks : [];
    const constellation = Array.isArray(brandHouse.constellation) ? brandHouse.constellation : [];
    const expectedMarks = new Set(["LVR", "LVS", "LVP", "LVL", "LVC", "LVA"]);
    if (brandHouse.schemaVersion !== "luxveritas.brand_house.v1") {
      issues.push("/data/lux-brand-house.json: schemaVersion mismatch");
    }
    if (liveBuildManifest?.brandHouseVersion && liveBuildManifest.brandHouseVersion !== brandHouse.version) {
      issues.push("/data/lux-brand-house.json: version does not match build manifest brandHouseVersion");
    }
    if (marks.length !== 6) {
      issues.push(`/data/lux-brand-house.json: expected 6 house marks, received ${marks.length}`);
    }
    if (constellation.length !== 6) {
      issues.push(`/data/lux-brand-house.json: expected 6 constellation links, received ${constellation.length}`);
    }
    for (const item of constellation) {
      if (!item.id || !item.from || !item.to || !item.label || !item.fanAction) {
        issues.push(`/data/lux-brand-house.json: constellation item ${item.id || "missing"} lacks id, from, to, label, or fanAction`);
      }
      if (item.from && !expectedMarks.has(item.from)) {
        issues.push(`/data/lux-brand-house.json: constellation ${item.id || "item"} has invalid from mark ${item.from}`);
      }
      if (item.to && !expectedMarks.has(item.to)) {
        issues.push(`/data/lux-brand-house.json: constellation ${item.id || "item"} has invalid to mark ${item.to}`);
      }
    }
    for (const item of marks) {
      if (!expectedMarks.has(item.mark)) {
        issues.push(`/data/lux-brand-house.json: unexpected house mark ${item.mark || "missing"}`);
      }
      if (!item.logo || !item.logo.startsWith("/assets/") || !item.logo.endsWith(".svg")) {
        issues.push(`/data/lux-brand-house.json: ${item.mark || "item"} has invalid logo path`);
        continue;
      }
      try {
        const asset = await fetchWithTimeout(item.logo);
        const contentType = asset.response.headers.get("content-type") || "";
        if (!asset.response.ok) {
          issues.push(`${item.logo}: expected HTTP 200, received ${asset.response.status}`);
        }
        if (!/image\/svg\+xml/i.test(contentType)) {
          issues.push(`${item.logo}: expected image/svg+xml, received ${contentType || "missing"}`);
        }
        if (!asset.text.includes("<svg") || !asset.text.includes(item.mark)) {
          issues.push(`${item.logo}: missing SVG markup or ${item.mark} mark text`);
        }
      } catch (error) {
        issues.push(`${item.logo}: request failed (${error.message})`);
      }
    }
  }
} catch (error) {
  issues.push(`/data/lux-brand-house.json: invalid response (${error.message})`);
}

try {
  const { response, text } = await fetchWithTimeout("/data/lux-fan-flywheel.json");
  if (!response.ok) {
    issues.push(`/data/lux-fan-flywheel.json: expected HTTP 200, received ${response.status}`);
  } else {
    const fanFlywheel = JSON.parse(text);
    const stages = Array.isArray(fanFlywheel.stages) ? fanFlywheel.stages : [];
    const expectedStages = ["listen", "watch", "join", "attend", "collect", "create"];
    if (fanFlywheel.schemaVersion !== "luxveritas.fan_flywheel.v1") {
      issues.push("/data/lux-fan-flywheel.json: schemaVersion mismatch");
    }
    if (liveBuildManifest?.fanFlywheelVersion && liveBuildManifest.fanFlywheelVersion !== fanFlywheel.version) {
      issues.push("/data/lux-fan-flywheel.json: version does not match build manifest fanFlywheelVersion");
    }
    if (stages.map((stage) => stage.id).join("|") !== expectedStages.join("|")) {
      issues.push(`/data/lux-fan-flywheel.json: expected stages ${expectedStages.join(", ")}`);
    }
    for (const stage of stages) {
      if (!stage.path || !stage.path.startsWith("/") || !stage.path.endsWith(".html")) {
        issues.push(`/data/lux-fan-flywheel.json: ${stage.id || "stage"} has invalid path`);
      }
      if (!stage.action || !stage.title || !stage.body) {
        issues.push(`/data/lux-fan-flywheel.json: ${stage.id || "stage"} missing public copy`);
      }
    }
  }
} catch (error) {
  issues.push(`/data/lux-fan-flywheel.json: invalid response (${error.message})`);
}

try {
  const { response, text } = await fetchWithTimeout("/data/lux-drop-room.json");
  if (!response.ok) {
    issues.push(`/data/lux-drop-room.json: expected HTTP 200, received ${response.status}`);
  } else {
    const dropRoom = JSON.parse(text);
    const drops = Array.isArray(dropRoom.drops) ? dropRoom.drops : [];
    const expectedDrops = ["release-object", "visual-edition", "live-room-access", "atelier-piece"];
    if (dropRoom.schemaVersion !== "luxveritas.drop_room.v1") {
      issues.push("/data/lux-drop-room.json: schemaVersion mismatch");
    }
    if (liveBuildManifest?.dropRoomVersion && liveBuildManifest.dropRoomVersion !== dropRoom.version) {
      issues.push("/data/lux-drop-room.json: version does not match build manifest dropRoomVersion");
    }
    if (dropRoom.commerceMode !== "waitlist_only") {
      issues.push("/data/lux-drop-room.json: commerceMode must remain waitlist_only");
    }
    if (!/No purchase is accepted/i.test(dropRoom.notice || "")) {
      issues.push("/data/lux-drop-room.json: missing no-purchase notice");
    }
    if (drops.map((drop) => drop.id).join("|") !== expectedDrops.join("|")) {
      issues.push(`/data/lux-drop-room.json: expected drops ${expectedDrops.join(", ")}`);
    }
  }
} catch (error) {
  issues.push(`/data/lux-drop-room.json: invalid response (${error.message})`);
}

try {
  const { response, text } = await fetchWithTimeout("/data/lux-portal-rooms.json");
  if (!response.ok) {
    issues.push(`/data/lux-portal-rooms.json: expected HTTP 200, received ${response.status}`);
  } else {
    const portalRooms = JSON.parse(text);
    const rooms = Array.isArray(portalRooms.rooms) ? portalRooms.rooms : [];
    const expectedRooms = ["member", "artist", "creator", "press", "partner", "investor", "operator"];
    if (portalRooms.schemaVersion !== "luxveritas.portal_rooms.v1") {
      issues.push("/data/lux-portal-rooms.json: schemaVersion mismatch");
    }
    if (liveBuildManifest?.portalRoomsVersion && liveBuildManifest.portalRoomsVersion !== portalRooms.version) {
      issues.push("/data/lux-portal-rooms.json: version does not match build manifest portalRoomsVersion");
    }
    if (portalRooms.accessMode !== "request_access_only") {
      issues.push("/data/lux-portal-rooms.json: accessMode must remain request_access_only");
    }
    if (!/No account, payment, entitlement, or private room is activated/i.test(portalRooms.notice || "")) {
      issues.push("/data/lux-portal-rooms.json: missing no-account/no-payment notice");
    }
    if (rooms.map((room) => room.id).join("|") !== expectedRooms.join("|")) {
      issues.push(`/data/lux-portal-rooms.json: expected rooms ${expectedRooms.join(", ")}`);
    }
  }
} catch (error) {
  issues.push(`/data/lux-portal-rooms.json: invalid response (${error.message})`);
}

try {
  const { response, text } = await fetchWithTimeout("/data/lux-phase-status.json");
  if (!response.ok) {
    issues.push(`/data/lux-phase-status.json: expected HTTP 200, received ${response.status}`);
  } else {
    const phaseStatus = JSON.parse(text);
    const currentPhase = phaseStatus.currentPhase || {};
    if (phaseStatus.schemaVersion !== "luxveritas.phase_status.v1") {
      issues.push("/data/lux-phase-status.json: schemaVersion mismatch");
    }
    if (liveBuildManifest?.phaseStatusVersion && liveBuildManifest.phaseStatusVersion !== phaseStatus.version) {
      issues.push("/data/lux-phase-status.json: version does not match build manifest phaseStatusVersion");
    }
    if (currentPhase.id !== "phase-5" || currentPhase.status !== "active_pilot") {
      issues.push("/data/lux-phase-status.json: current phase mismatch");
    }
    if (phaseStatus.pilotStatus !== "pilot_ready_with_public_launch_blockers") {
      issues.push("/data/lux-phase-status.json: pilotStatus mismatch");
    }
    if (phaseStatus.pilotEvidence?.assetVersion !== liveBuildManifest?.assetVersion) {
      const message = "/data/lux-phase-status.json: pilotEvidence asset version does not match live build manifest; rerun the live pilot write gate after deploy";
      if (requireCurrentPilotEvidence) issues.push(message);
      else warnings.push(message);
    }
    if (!phaseStatus.pilotEvidence?.verifiedCapabilities?.includes("post_write_reconciliation")) {
      issues.push("/data/lux-phase-status.json: missing post-write reconciliation evidence");
    }
    for (const blocker of ["privacy_review", "terms_review"]) {
      if (!phaseStatus.publicLaunchBlockers?.includes(blocker)) {
        issues.push(`/data/lux-phase-status.json: missing public launch blocker ${blocker}`);
      }
    }
  }
} catch (error) {
  issues.push(`/data/lux-phase-status.json: invalid response (${error.message})`);
}

try {
  const { response, text } = await fetchWithTimeout("/data/lux-pilot-write-evidence.json");
  if (!response.ok) {
    issues.push(`/data/lux-pilot-write-evidence.json: expected HTTP 200, received ${response.status}`);
  } else {
    const pilotWriteEvidence = JSON.parse(text);
    if (pilotWriteEvidence.schemaVersion !== "luxveritas.pilot_write_evidence.v1") {
      issues.push("/data/lux-pilot-write-evidence.json: schemaVersion mismatch");
    }
    if (pilotWriteEvidence.assetVersion !== liveBuildManifest?.assetVersion) {
      const message = "/data/lux-pilot-write-evidence.json: assetVersion does not match live build manifest; rerun the live pilot write gate after deploy";
      if (requireCurrentPilotEvidence) issues.push(message);
      else warnings.push(message);
    }
    if (!/^\d{14}$/.test(pilotWriteEvidence.qaRunId || "")) {
      issues.push("/data/lux-pilot-write-evidence.json: qaRunId missing or invalid");
    }
    if (pilotWriteEvidence.result !== "passed") {
      issues.push("/data/lux-pilot-write-evidence.json: result must be passed");
    }
    if (pilotWriteEvidence.writeEvidence?.formCaptureIntents !== 11 || pilotWriteEvidence.writeEvidence?.eventWrites !== 11) {
      issues.push("/data/lux-pilot-write-evidence.json: write evidence must cover 11 forms and 11 events");
    }
    if (pilotWriteEvidence.writeEvidence?.inboxDeliveryRequired !== true || pilotWriteEvidence.writeEvidence?.postWriteReconciliation !== true) {
      issues.push("/data/lux-pilot-write-evidence.json: missing inbox delivery or reconciliation proof");
    }
    const freshness = pilotEvidenceFreshness(pilotWriteEvidence.updatedAt, { maxAgeHours: maxPilotAgeHours });
    if (!freshness.ok) {
      const message = `/data/lux-pilot-write-evidence.json: ${freshness.message}`;
      if (requireCurrentPilotEvidence) issues.push(message);
      else warnings.push(message);
    }
  }
} catch (error) {
  issues.push(`/data/lux-pilot-write-evidence.json: invalid response (${error.message})`);
}

try {
  const { response, text } = await fetchWithTimeout("/data/lux-pilot-bug-register.json");
  if (!response.ok) {
    issues.push(`/data/lux-pilot-bug-register.json: expected HTTP 200, received ${response.status}`);
  } else {
    const bugRegister = JSON.parse(text);
    const coverageEvidence = Array.isArray(bugRegister.coverageEvidence) ? bugRegister.coverageEvidence : [];
    const checks = Array.isArray(bugRegister.checks) ? bugRegister.checks : [];
    const items = Array.isArray(bugRegister.items) ? bugRegister.items : [];
    if (bugRegister.schemaVersion !== "luxveritas.pilot_bug_register.v1") {
      issues.push("/data/lux-pilot-bug-register.json: schemaVersion mismatch");
    }
    if (liveBuildManifest?.pilotBugRegisterVersion && liveBuildManifest.pilotBugRegisterVersion !== bugRegister.version) {
      issues.push("/data/lux-pilot-bug-register.json: version does not match build manifest pilotBugRegisterVersion");
    }
    if (bugRegister.evidence?.assetVersion !== liveBuildManifest?.assetVersion) {
      issues.push("/data/lux-pilot-bug-register.json: assetVersion does not match live build manifest");
    }
    if (bugRegister.status !== "no_known_blocking_bugs" || bugRegister.decision !== "pilot_can_continue") {
      issues.push("/data/lux-pilot-bug-register.json: expected no known blocking bugs and pilot_can_continue");
    }
    if (bugRegister.summary?.openBlockingBugs !== 0 || bugRegister.summary?.openHighBugs !== 0 || bugRegister.summary?.openTotalBugs !== 0) {
      issues.push("/data/lux-pilot-bug-register.json: open bug counts must be zero for current pilot evidence");
    }
    if (!coverageEvidence.some((item) => item.coverage === "public_capture") || !coverageEvidence.some((item) => item.coverage === "media_player")) {
      issues.push("/data/lux-pilot-bug-register.json: missing public capture or media-player coverage evidence");
    }
    if (!checks.some((item) => item.id === "submit_freeze_regression" && item.status === "passed")) {
      issues.push("/data/lux-pilot-bug-register.json: missing submit freeze regression check");
    }
    if (items.some((item) => ["blocking", "critical"].includes(item.severity) && !["fixed", "closed", "resolved"].includes(item.status))) {
      issues.push("/data/lux-pilot-bug-register.json: contains open blocking or critical bug");
    }
  }
} catch (error) {
  issues.push(`/data/lux-pilot-bug-register.json: invalid response (${error.message})`);
}

try {
  const { response, text } = await fetchWithTimeout("/site.webmanifest");
  if (!response.ok) {
    issues.push(`/site.webmanifest: expected HTTP 200, received ${response.status}`);
  } else {
    const manifest = JSON.parse(text);
    if (manifest.name !== "Lux Veritas" || manifest.short_name !== "Lux Veritas") {
      issues.push("/site.webmanifest: name mismatch");
    }
    if (manifest.start_url !== "/index.html" || manifest.display !== "standalone") {
      issues.push("/site.webmanifest: expected installable start_url/display");
    }
    const icon = Array.isArray(manifest.icons)
      ? manifest.icons.find((item) => item.src === "/assets/luxveritas-icon.svg")
      : null;
    if (!icon || icon.type !== "image/svg+xml") {
      issues.push("/site.webmanifest: missing Lux Veritas SVG icon");
    }
  }
} catch (error) {
  issues.push(`/site.webmanifest: invalid response (${error.message})`);
}

try {
  const { response, text } = await fetchWithTimeout("/data/lux-media-manifest.json");
  if (!response.ok) {
    issues.push(`/data/lux-media-manifest.json: expected HTTP 200, received ${response.status}`);
  } else {
    const manifest = JSON.parse(text);
    const items = Array.isArray(manifest.items) ? manifest.items : [];
    const sourceTypes = new Set(items.map((item) => item.sourceType));
    const ids = new Set(items.map((item) => item.id));
    for (const id of ["spmvp-release", "visual-world", "lux-radio"]) {
      if (!ids.has(id)) issues.push(`/data/lux-media-manifest.json: missing media item ${id}`);
    }
    for (const sourceType of ["audio", "video", "stream"]) {
      if (!sourceTypes.has(sourceType)) issues.push(`/data/lux-media-manifest.json: missing sourceType ${sourceType}`);
    }
  }
} catch (error) {
  issues.push(`/data/lux-media-manifest.json: invalid response (${error.message})`);
}

try {
  const { response, text } = await fetchWithTimeout("/data/lux-radio-programming.json");
  if (!response.ok) {
    issues.push(`/data/lux-radio-programming.json: expected HTTP 200, received ${response.status}`);
  } else {
    const radio = JSON.parse(text);
    const readiness = Array.isArray(radio.readiness) ? radio.readiness : [];
    const listenerPath = Array.isArray(radio.listenerPath) ? radio.listenerPath : [];
    if (radio.schemaVersion !== "luxveritas.radio_programming.v1") {
      issues.push("/data/lux-radio-programming.json: schemaVersion mismatch");
    }
    if (radio.mode !== "preview_signal_room") {
      issues.push("/data/lux-radio-programming.json: mode must be preview_signal_room");
    }
    if (!radio.version || radio.version !== liveBuildManifest?.radioProgrammingVersion) {
      issues.push("/data/lux-radio-programming.json: version must match build manifest radioProgrammingVersion");
    }
    if (!/Preview/i.test(radio.onAir?.status || "")) {
      issues.push("/data/lux-radio-programming.json: onAir status must disclose preview state");
    }
    if (listenerPath.length < 3) {
      issues.push("/data/lux-radio-programming.json: listener path needs at least 3 steps");
    }
    const readinessIds = new Set(readiness.map((item) => item.id));
    for (const id of ["preview-source", "playback-reporting", "full-programming"]) {
      if (!readinessIds.has(id)) issues.push(`/data/lux-radio-programming.json: missing readiness item ${id}`);
    }
  }
} catch (error) {
  issues.push(`/data/lux-radio-programming.json: invalid response (${error.message})`);
}

try {
  const { response, text } = await fetchWithTimeout("/data/lux-launch-closeout-public.json");
  if (!response.ok) {
    issues.push(`/data/lux-launch-closeout-public.json: expected HTTP 200, received ${response.status}`);
  } else {
    const closeout = JSON.parse(text);
    const items = Array.isArray(closeout.items) ? closeout.items : [];
    if (closeout.schemaVersion !== "luxveritas.launch_closeout_public.v1") {
      issues.push("/data/lux-launch-closeout-public.json: schemaVersion mismatch");
    }
    if (!closeout.updatedAt) {
      issues.push("/data/lux-launch-closeout-public.json: missing updatedAt");
    }
    for (const id of ["www_redirect", "inbox_notifications", "privacy_review", "terms_review"]) {
      if (!items.some((item) => item.id === id)) {
        issues.push(`/data/lux-launch-closeout-public.json: missing closeout item ${id}`);
      }
    }
    if (/commands|requiredEvidence|RESEND_API_KEY|firebase login|Secret Manager/i.test(text)) {
      issues.push("/data/lux-launch-closeout-public.json: contains operator-only closeout fields");
    }
  }
} catch (error) {
  issues.push(`/data/lux-launch-closeout-public.json: invalid response (${error.message})`);
}

try {
  const { response, text } = await fetchWithTimeout("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({}),
    readBody: true
  });
  if (response.status === 403 && /Forbidden/i.test(text)) {
    issues.push("/api/submit: Cloud Run public access is blocked (HTTP 403).");
  } else if (response.status === 400 || response.status === 429) {
    // Empty payload should reach the function and fail validation, not Cloud Run IAM.
  } else if (response.ok) {
    warnings.push(`/api/submit: function is reachable and returned HTTP ${response.status}.`);
  } else {
    issues.push(`/api/submit: unexpected HTTP ${response.status}`);
  }
} catch (error) {
  issues.push(`/api/submit: request failed (${error.message})`);
}

try {
  const { response, text } = await fetchWithTimeout("/api/event", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({}),
    readBody: true
  });
  if (response.status === 403 && /Forbidden/i.test(text)) {
    issues.push("/api/event: Cloud Run public access is blocked (HTTP 403).");
  } else if (response.status === 400 || response.status === 429) {
    // Empty payload should reach the function and fail validation, not Hosting or Cloud Run IAM.
  } else if (response.ok) {
    warnings.push(`/api/event: function is reachable and returned HTTP ${response.status}.`);
  } else {
    issues.push(`/api/event: unexpected HTTP ${response.status}`);
  }
} catch (error) {
  issues.push(`/api/event: request failed (${error.message})`);
}

try {
  const reportToken = process.env.LUX_REPORT_TOKEN;
  const { response, text } = await fetchWithTimeout("/api/report", {
    method: "GET",
    headers: reportToken
      ? { Accept: "application/json", Authorization: `Bearer ${reportToken}` }
      : { Accept: "application/json" },
    readBody: true
  });
  if (reportToken && response.ok) {
    const report = JSON.parse(text);
    if (!report.summary?.submissions || !report.summary?.events) {
      issues.push("/api/report: approved response is missing activity summaries");
    }
    if (!["operator_token", "google_oauth", "approved"].includes(report.authMode)) {
      issues.push(`/api/report: approved response has unexpected authMode ${report.authMode || "none"}`);
    }
  } else if (reportToken) {
    issues.push(`/api/report: approved token expected HTTP 200, received ${response.status}`);
  } else if (response.status === 403 && /Forbidden/i.test(text)) {
    issues.push("/api/report: Cloud Run public access is blocked (HTTP 403).");
  } else if (response.status === 401) {
    // Missing token should reach the function and be rejected there.
  } else {
    issues.push(`/api/report: expected protected HTTP 401, received ${response.status}`);
  }
} catch (error) {
  issues.push(`/api/report: request failed (${error.message})`);
}

try {
  const reportToken = process.env.LUX_REPORT_TOKEN;
  const { response, text } = await fetchWithTimeout("/api/report", {
    method: "POST",
    headers: reportToken
      ? { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${reportToken}` }
      : { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ action: "replay_pending", limit: 1 }),
    readBody: true
  });
  if (reportToken && (response.ok || response.status === 202)) {
    const replay = JSON.parse(text);
    if (!replay.ok) issues.push("/api/report replay: approved response did not return ok:true");
  } else if (reportToken) {
    issues.push(`/api/report replay: approved token expected accepted response, received ${response.status}`);
  } else if (response.status === 403 && /Forbidden/i.test(text)) {
    issues.push("/api/report replay: Cloud Run public access is blocked (HTTP 403).");
  } else if (response.status === 401) {
    // Missing token should reach the function and be rejected there.
  } else {
    issues.push(`/api/report replay: expected protected HTTP 401, received ${response.status}`);
  }
} catch (error) {
  issues.push(`/api/report replay: request failed (${error.message})`);
}

if (warnings.length) {
  console.warn("Live smoke warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (issues.length) {
  console.error(`Live site QA failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Live site QA passed for ${baseUrl}.`);
