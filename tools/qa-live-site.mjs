import { readFile } from "node:fs/promises";

const baseUrl = (process.env.LUX_LIVE_URL || "https://luxveritas.media").replace(/\/$/, "");
const issues = [];
const warnings = [];
const buildScript = await readFile("tools/build-static.mjs", "utf8");
const expectedAssetVersion = buildScript.match(/const assetVersion = "([^"]+)"/)?.[1] || "";

const publicRoutes = [
  "/",
  "/music.html",
  "/spmvp.html",
  "/membership.html",
  "/submissions.html",
  "/legal/privacy.html",
  "/legal/terms.html",
  "/portal/index.html",
  "/portal/reporting.html"
];

const publicDataRoutes = [
  "/data/lux-brand-house.json",
  "/data/lux-fan-flywheel.json",
  "/data/lux-drop-room.json",
  "/data/lux-portal-rooms.json",
  "/data/lux-apps.json",
  "/data/lux-media-manifest.json",
  "/data/lux-build-manifest.json",
  "/data/lux-public-terms.json"
];

const privateDataRoutes = [
  "/data/cr8-store-submission.json",
  "/data/lux-action-inventory.json",
  "/data/lux-launch-closeout-public.json",
  "/data/lux-launch-readiness.json",
  "/data/lux-legal-review.json",
  "/data/lux-open-approvals.json",
  "/data/lux-phase-status.json",
  "/data/lux-pilot-bug-register.json",
  "/data/lux-pilot-write-evidence.json",
  "/data/lux-radio-programming.json",
  "/data/lux-release-room.json"
];

if (!expectedAssetVersion) issues.push("tools/build-static.mjs: missing assetVersion");

async function fetchWithTimeout(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 15000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method || "GET",
      headers: options.headers,
      body: options.body,
      redirect: options.redirect || "follow",
      signal: controller.signal
    });
    const text = options.readBody === false ? "" : await response.text();
    return { response, text };
  } finally {
    clearTimeout(timeout);
  }
}

async function expectStatus(path, status) {
  try {
    const result = await fetchWithTimeout(path);
    if (result.response.status !== status) {
      issues.push(`${path}: expected HTTP ${status}, received ${result.response.status}`);
    }
    return result;
  } catch (error) {
    issues.push(`${path}: request failed (${error.message})`);
    return { response: { status: 0, ok: false, headers: new Headers() }, text: "" };
  }
}

for (const route of publicRoutes) {
  await expectStatus(route, 200);
}

try {
  const { response } = await fetchWithTimeout("/", { readBody: false });
  const expectedHeaders = new Map([
    ["x-content-type-options", "nosniff"],
    ["referrer-policy", "strict-origin-when-cross-origin"],
    ["permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()"],
    ["x-frame-options", "SAMEORIGIN"]
  ]);
  for (const [key, value] of expectedHeaders) {
    const actual = response.headers.get(key);
      if (actual !== value) issues.push(`/: header ${key} expected ${value}, received ${actual || "missing"}`);
  }
  const hsts = response.headers.get("strict-transport-security") || "";
  const hstsMaxAge = Number(hsts.match(/max-age=(\d+)/i)?.[1] || 0);
  if (hstsMaxAge < 31536000) {
    issues.push(`/: header strict-transport-security must keep max-age at least 31536000, received ${hsts || "missing"}`);
  }
} catch (error) {
  issues.push(`/: header check failed (${error.message})`);
}

const missingPath = `/not-a-lux-route-${Date.now()}`;
const notFound = await expectStatus(missingPath, 404);
if (!notFound.text.includes("The signal ends here.")) {
  issues.push(`${missingPath}: missing Lux Veritas 404 content`);
}
if (!notFound.text.includes('name="robots" content="noindex, nofollow"')) {
  issues.push(`${missingPath}: 404 response must be noindex, nofollow`);
}

const music = await expectStatus("/music.html", 200);
for (const marker of [
  `app.js?v=${expectedAssetVersion}`,
  `styles.css?v=${expectedAssetVersion}`,
  "data-media-player",
  'data-media-action="play"',
  'data-media-action="watch"',
  'data-media-action="radio"',
  'data-release-step="listen"',
  "data-radio-on-air"
]) {
  if (!music.text.includes(marker)) issues.push(`/music.html: missing ${marker}`);
}
for (const marker of ["data-release-readiness-item", "data-radio-readiness-list"]) {
  if (music.text.includes(marker)) issues.push(`/music.html: exposes ${marker}`);
}

const reportShell = await expectStatus("/portal/reporting.html", 200);
if (!reportShell.text.includes("No activity records, launch controls, workflow details, or operator tools are published on this route.")) {
  issues.push("/portal/reporting.html: missing public boundary copy");
}
for (const marker of ["data-private-report", "data-report-action", "data-action-inventory", "data-launch-readiness"]) {
  if (reportShell.text.includes(marker)) issues.push(`/portal/reporting.html: exposes ${marker}`);
}

for (const route of ["/legal/privacy.html", "/legal/terms.html"]) {
  const result = await expectStatus(route, 200);
  if (result.text.includes('name="robots" content="noindex, nofollow"')) {
    issues.push(`${route}: approved legal page must be indexable`);
  }
  if (!result.text.includes("Effective July 4, 2026.")) {
    issues.push(`${route}: missing effective date`);
  }
}

for (const route of publicDataRoutes) {
  const result = await expectStatus(route, 200);
  const contentType = result.response.headers.get("content-type") || "";
  if (result.response.ok && !/application\/json/i.test(contentType)) {
    issues.push(`${route}: expected JSON content type, received ${contentType || "missing"}`);
  }
}

for (const route of privateDataRoutes) {
  await expectStatus(route, 404);
}

try {
  const { response, text } = await fetchWithTimeout("/data/lux-build-manifest.json");
  if (response.ok) {
    const manifest = JSON.parse(text);
    if (manifest.schemaVersion !== "luxveritas.build_manifest.v1") {
      issues.push("/data/lux-build-manifest.json: schemaVersion mismatch");
    }
    if (manifest.assetVersion !== expectedAssetVersion || manifest.version !== expectedAssetVersion) {
      issues.push(`/data/lux-build-manifest.json: expected ${expectedAssetVersion}, received ${manifest.assetVersion || manifest.version || "missing"}`);
    }
    for (const field of ["releaseRoomVersion", "radioProgrammingVersion", "pilotBugRegisterVersion", "actionInventoryVersion", "openApprovalsDecision", "phaseStatusVersion"]) {
      if (field in manifest) issues.push(`/data/lux-build-manifest.json: exposes ${field}`);
    }
  }
} catch (error) {
  issues.push(`/data/lux-build-manifest.json: invalid response (${error.message})`);
}

try {
  const { response, text } = await fetchWithTimeout("/data/lux-media-manifest.json");
  if (response.ok) {
    const manifest = JSON.parse(text);
    const items = Array.isArray(manifest.items) ? manifest.items : [];
    const ids = new Set(items.map((item) => item.id));
    for (const id of ["spmvp-release", "visual-world", "lux-radio"]) {
      if (!ids.has(id)) issues.push(`/data/lux-media-manifest.json: missing ${id}`);
    }
  }
} catch (error) {
  issues.push(`/data/lux-media-manifest.json: invalid response (${error.message})`);
}

try {
  const { response, text } = await fetchWithTimeout("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({})
  });
  if (response.status === 403 && /Forbidden/i.test(text)) {
    issues.push("/api/submit: public function access is blocked");
  } else if (![400, 429].includes(response.status)) {
    warnings.push(`/api/submit: empty-payload probe returned HTTP ${response.status}`);
  }
} catch (error) {
  issues.push(`/api/submit: request failed (${error.message})`);
}

if (warnings.length) {
  console.warn("Live site QA warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (issues.length) {
  console.error(`Live site QA failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Live site QA passed for ${baseUrl}: public routes, true 404, artifact boundary, legal pages, media, headers, and form API.`);
