const baseUrl = (process.env.LUX_LIVE_URL || "https://luxveritas.media").replace(/\/$/, "");
const issues = [];
const warnings = [];
const requiredRoutes = [
  "/",
  "/music.html",
  "/spmvp.html",
  "/membership.html",
  "/submissions.html",
  "/portal/reporting.html"
];
const expectedAssetVersion = "20260608-site-events";

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

const musicHtml = await checkRoute("/music.html");
if (musicHtml) {
  for (const required of [
    `app.js?v=${expectedAssetVersion}`,
    "data-media-player",
    "data-media-source-shell",
    "data-media-action=\"play\"",
    "data-media-action=\"watch\"",
    "data-media-action=\"radio\"",
    "data-source-type=\"audio\"",
    "data-source-type=\"video\"",
    "data-source-type=\"stream\""
  ]) {
    if (!musicHtml.includes(required)) issues.push(`/music.html: missing ${required}`);
  }
}

const reportHtml = await checkRoute("/portal/reporting.html");
if (reportHtml && !reportHtml.includes('name="robots" content="noindex, nofollow"')) {
  issues.push("/portal/reporting.html: missing noindex metadata");
}

try {
  const { response, text } = await fetchWithTimeout("/data/lux-media-manifest.json");
  if (!response.ok) {
    issues.push(`/data/lux-media-manifest.json: expected HTTP 200, received ${response.status}`);
  } else {
    const manifest = JSON.parse(text);
    const items = Array.isArray(manifest.items) ? manifest.items : [];
    const sourceTypes = new Set(items.map((item) => item.sourceType));
    for (const sourceType of ["audio", "video", "stream"]) {
      if (!sourceTypes.has(sourceType)) issues.push(`/data/lux-media-manifest.json: missing sourceType ${sourceType}`);
    }
  }
} catch (error) {
  issues.push(`/data/lux-media-manifest.json: invalid response (${error.message})`);
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
