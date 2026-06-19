const baseUrl = (process.env.LUX_LIVE_URL || "https://luxveritas.media").replace(/\/$/, "");
const issues = [];
const warnings = [];
const requiredIds = new Set(["spmvp-release", "visual-world", "lux-radio"]);
const expectedTypes = {
  audio: /audio\/(wav|wave|x-wav)/i,
  stream: /audio\/(wav|wave|x-wav|mpeg|aac|ogg)|application\/octet-stream/i,
  video: /video\/webm/i
};

function issue(message) {
  issues.push(message);
}

function warn(message) {
  warnings.push(message);
}

function absoluteUrl(value) {
  if (!value) return "";
  if (/^https:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${baseUrl}${value}`;
  return "";
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 12000);
  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: options.headers,
      signal: controller.signal
    });
    if (options.arrayBuffer) return { response, body: await response.arrayBuffer() };
    return { response, text: options.readBody === false ? "" : await response.text() };
  } finally {
    clearTimeout(timeout);
  }
}

function bytesToAscii(buffer) {
  return String.fromCharCode(...new Uint8Array(buffer).slice(0, 16));
}

async function checkMediaHead(item, url) {
  try {
    const { response } = await fetchWithTimeout(url, { method: "HEAD", readBody: false });
    if (!response.ok) {
      issue(`${item.id}: source HEAD expected HTTP 200, received ${response.status}`);
      return;
    }
    const contentType = response.headers.get("content-type") || "";
    const pattern = expectedTypes[item.sourceType];
    if (pattern && !pattern.test(contentType)) {
      issue(`${item.id}: sourceType ${item.sourceType} expected matching content type, received ${contentType || "missing"}`);
    }
    const length = Number(response.headers.get("content-length") || "0");
    if (length > 0 && length < 1024) {
      warn(`${item.id}: media source is unusually small (${length} bytes)`);
    }
  } catch (error) {
    issue(`${item.id}: source HEAD failed (${error.message})`);
  }
}

async function checkMediaSignature(item, url) {
  try {
    const { response, body } = await fetchWithTimeout(url, {
      headers: { Range: "bytes=0-15" },
      arrayBuffer: true
    });
    if (![200, 206].includes(response.status)) {
      issue(`${item.id}: source range GET expected HTTP 200/206, received ${response.status}`);
      return;
    }
    const bytes = new Uint8Array(body);
    if (item.sourceType === "video") {
      const webm = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
      if (!webm) issue(`${item.id}: video source does not start with a WebM/EBML signature`);
      return;
    }
    if (["audio", "stream"].includes(item.sourceType)) {
      const ascii = bytesToAscii(body);
      if (!ascii.startsWith("RIFF") || !ascii.includes("WAVE")) {
        issue(`${item.id}: audio/radio source does not start with a WAV RIFF/WAVE signature`);
      }
    }
  } catch (error) {
    issue(`${item.id}: source signature check failed (${error.message})`);
  }
}

async function checkPoster(item) {
  if (!item.posterUrl) return;
  const url = absoluteUrl(item.posterUrl);
  if (!url) {
    issue(`${item.id}: posterUrl must be HTTPS or root-relative`);
    return;
  }
  try {
    const { response, text } = await fetchWithTimeout(url);
    if (!response.ok) {
      issue(`${item.id}: poster expected HTTP 200, received ${response.status}`);
      return;
    }
    const contentType = response.headers.get("content-type") || "";
    if (!/image\/(svg\+xml|png|jpeg|webp)/i.test(contentType)) {
      issue(`${item.id}: poster expected image content type, received ${contentType || "missing"}`);
    }
    if (/svg/i.test(contentType) && !text.includes("<svg")) {
      issue(`${item.id}: SVG poster is missing SVG markup`);
    }
  } catch (error) {
    issue(`${item.id}: poster check failed (${error.message})`);
  }
}

let manifest = null;
let buildManifest = null;
try {
  const { response, text } = await fetchWithTimeout(`${baseUrl}/data/lux-media-manifest.json`);
  if (!response.ok) {
    issue(`/data/lux-media-manifest.json expected HTTP 200, received ${response.status}`);
  } else {
    manifest = JSON.parse(text);
  }
} catch (error) {
  issue(`/data/lux-media-manifest.json failed (${error.message})`);
}

try {
  const { response, text } = await fetchWithTimeout(`${baseUrl}/data/lux-build-manifest.json`);
  if (!response.ok) {
    issue(`/data/lux-build-manifest.json expected HTTP 200, received ${response.status}`);
  } else {
    buildManifest = JSON.parse(text);
  }
} catch (error) {
  issue(`/data/lux-build-manifest.json failed (${error.message})`);
}

const items = Array.isArray(manifest?.items) ? manifest.items : [];
if (manifest) {
  if (manifest.schemaVersion !== "luxveritas.media_manifest.v1") {
    issue("media manifest schemaVersion mismatch");
  }
  if (buildManifest?.mediaManifestVersion && buildManifest.mediaManifestVersion !== manifest.version) {
    issue("media manifest version does not match live build manifest");
  }
}

const ids = new Set(items.map((item) => item.id));
for (const id of requiredIds) {
  if (!ids.has(id)) issue(`media manifest missing required item ${id}`);
}

const reportingKeys = new Set();
for (const item of items) {
  const label = item.id || "unknown-media-item";
  for (const field of ["sourceType", "sourceStatus", "sourceRequired", "sourceUrl", "reportingKey", "primaryAction"]) {
    if (!item[field] && item[field] !== true) issue(`${label}: missing ${field}`);
  }
  if (item.sourceRequired !== true) issue(`${label}: sourceRequired must be true for MVP media sources`);
  if (item.sourceStatus !== "ready") issue(`${label}: sourceStatus must be ready for live media QA`);
  if (reportingKeys.has(item.reportingKey)) issue(`${label}: duplicate reportingKey ${item.reportingKey}`);
  reportingKeys.add(item.reportingKey);

  const url = absoluteUrl(item.sourceUrl);
  if (!url) {
    issue(`${label}: sourceUrl must be HTTPS or root-relative`);
    continue;
  }
  await checkMediaHead(item, url);
  await checkMediaSignature(item, url);
  await checkPoster(item);
}

if (warnings.length) {
  console.warn("Live media source QA warnings:");
  for (const item of warnings) console.warn(`- ${item}`);
}

if (issues.length) {
  console.error(`Live media source QA failed with ${issues.length} issue(s):`);
  for (const item of issues) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`Live media source QA passed for ${items.length} media source(s) at ${baseUrl}.`);
